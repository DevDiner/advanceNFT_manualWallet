// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/structs/BitMaps.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

// Gas-optimized on-chain blob storage
import { SSTORE2 } from "solmate/src/utils/SSTORE2.sol";

/**
 * @title Advanced Generative On-Chain NFT
 * @notice Feature-rich NFT with commit–reveal, Merkle airdrop, on-chain rarity, and SVG art.
 * Adds: reveal expiry window + user/owner cancel paths + public escrow/refunds.
 * Now also persists each token’s SVG bytes on-chain via SSTORE2 (seal at mint).
 */
contract AdvancedNFT is ERC721, Ownable, ReentrancyGuard {
    using BitMaps for BitMaps.BitMap;
    using Strings for uint256;

    //  STATE & CONFIGURATION

    enum SaleState { Closed, Presale, PublicSale, SoldOut }
    SaleState public saleState;

    uint256 public constant MAX_SUPPLY = 1000;
    uint256 public constant MINT_PRICE = 0.01 ether;

    /// @notice Blocks to wait between commit and earliest reveal (minimum wait).
    uint256 public constant REVEAL_DELAY = 10;

    /// @notice Maximum window (in blocks) after the delay during which reveal is allowed.
    /// Example: ~1 day on ~12s blocks ≈ 7200. Adjust to your chain/needs.
    uint256 public constant REVEAL_WINDOW = 7200;

    uint256 public totalMinted;

    //  ON-CHAIN RARITY

    enum Rarity { Common, Uncommon, Rare, Legendary }
    mapping(uint256 => Rarity) public tokenRarity;

    //  COMMIT-REVEAL

    struct Commit {
        bytes32 hash;
        uint256 blockNumber;
    }

    // Per-address commits (one active at a time per phase)
    mapping(address => Commit) public airdropCommits;
    mapping(address => Commit) public publicCommits;

    /// @notice Escrow for public sale payments (funds sent at commit, consumed on reveal or refunded on cancel).
    mapping(address => uint256) public publicEscrow;

    //  PRESALE (MERKLE AIRDROP)

    bytes32 public immutable merkleRoot;
    BitMaps.BitMap private claimedBitmap;
    mapping(uint256 => bool) public claimedMap;
    bool public useBitmapForAirdrop;

    //  RANDOMNESS

    mapping(uint256 => uint256) private tokenMatrix;

    //  SPLITS

    address[] public contributors;
    mapping(address => uint256) public shares;
    uint256 public totalShares;
    mapping(address => uint256) public withdrawBalance;

    //  EVENTS

    event Minted(address indexed minter, uint256 indexed tokenId, Rarity rarity);
    event CommitCancelled(address indexed user, bool indexed isPublic, uint256 refund);
    event PublicCommitted(address indexed user, uint256 value);

    //  NEW (SSTORE2) — persisted SVG pointers and events
    mapping(uint256 => address) private _svgPtr; // tokenId => SSTORE2 pointer
    event TokenSVGPersisted(uint256 indexed tokenId, uint256 numBytes);

    //  CONSTRUCTOR

    constructor(
        bytes32 _merkleRoot,
        address[] memory _contributors,
        uint256[] memory _shares
    ) ERC721("Advanced Generative NFT", "AGNFT") Ownable(msg.sender) {
        merkleRoot = _merkleRoot;

        require(_contributors.length == _shares.length, "Inputs mismatch");
        for (uint256 i = 0; i < _contributors.length; i++) {
            address contributor = _contributors[i];
            uint256 share = _shares[i];
            require(contributor != address(0), "Invalid contributor");
            require(share > 0, "Shares must be > 0");
            contributors.push(contributor);
            shares[contributor] = share;
            totalShares += share;
        }
        saleState = SaleState.Closed;
    }

    //  ADMIN FUNCTIONS

    function setSaleState(SaleState _newState) external onlyOwner {
        saleState = _newState;
    }

    function setUseBitmap(bool _useBitmap) external onlyOwner {
        useBitmapForAirdrop = _useBitmap;
    }

    function distributeFunds() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to distribute");
        for (uint256 i = 0; i < contributors.length; i++) {
            address contributor = contributors[i];
            uint256 amount = (balance * shares[contributor]) / totalShares;
            withdrawBalance[contributor] += amount;
        }
    }

    //  INTERNAL HELPERS (EXPIRY)

    function _earliestReveal(Commit memory c) internal pure returns (uint256) {
        return c.blockNumber + REVEAL_DELAY;
    }

    function _expiryBlock(Commit memory c) internal pure returns (uint256) {
        return c.blockNumber + REVEAL_DELAY + REVEAL_WINDOW;
    }

    function _existsCommit(Commit memory c) internal pure returns (bool) {
        return c.hash != bytes32(0);
    }

    function _isExpired(Commit memory c) internal view returns (bool) {
        return _existsCommit(c) && block.number > _expiryBlock(c);
    }

    //  READ HELPERS FOR SCRIPTS/UX

    function getAirdropCommit(address user)
        external
        view
        returns (bytes32 hash, uint256 blockNumber, uint256 earliestRevealBlock, uint256 expiryBlock, bool expired)
    {
        Commit memory c = airdropCommits[user];
        if (!_existsCommit(c)) return (bytes32(0), 0, 0, 0, false);
        return (c.hash, c.blockNumber, _earliestReveal(c), _expiryBlock(c), _isExpired(c));
    }

    function getPublicCommit(address user)
        external
        view
        returns (bytes32 hash, uint256 blockNumber, uint256 earliestRevealBlock, uint256 expiryBlock, bool expired, uint256 escrow)
    {
        Commit memory c = publicCommits[user];
        if (!_existsCommit(c)) return (bytes32(0), 0, 0, 0, false, 0);
        return (c.hash, c.blockNumber, _earliestReveal(c), _expiryBlock(c), _isExpired(c), publicEscrow[user]);
    }

    //  MINTING WORKFLOW

    /// @notice Presale commit.
    /// @param commitHash keccak256(abi.encode(secret)) – matches reveal check below.
    function commitAirdrop(bytes32 commitHash) external nonReentrant {
        require(saleState == SaleState.Presale, "Presale is not active");
        require(airdropCommits[msg.sender].hash == bytes32(0), "Already committed");
        airdropCommits[msg.sender] = Commit({ hash: commitHash, blockNumber: block.number });
    }

    /// @notice Reveal a presale commit and mint.
    function revealAirdrop(uint256 index, bytes32 secret, bytes32[] calldata proof) external nonReentrant {
        require(saleState == SaleState.Presale, "Presale is not active");

        Commit memory c = airdropCommits[msg.sender];
        require(_existsCommit(c), "No commit");
        require(block.number >= _earliestReveal(c), "Reveal too early");
        require(block.number <= _expiryBlock(c), "Commit expired");
        require(keccak256(abi.encode(secret)) == c.hash, "Invalid secret");

        bytes32 leaf = keccak256(abi.encodePacked(index, msg.sender));
        require(MerkleProof.verify(proof, merkleRoot, leaf), "Invalid Merkle proof");

        if (useBitmapForAirdrop) {
            require(!claimedBitmap.get(index), "Already claimed");
            claimedBitmap.set(index);
        } else {
            require(!claimedMap[index], "Already claimed");
            claimedMap[index] = true;
        }

        delete airdropCommits[msg.sender];
        _mintRandom(msg.sender, secret);
    }

    /// @notice Public sale commit with exact-price escrow.
    function commitPublic(bytes32 commitHash) external payable nonReentrant {
        require(saleState == SaleState.PublicSale, "Public sale is not active");
        require(publicCommits[msg.sender].hash == bytes32(0), "Already committed");
        require(msg.value == MINT_PRICE, "Incorrect payment");

        publicCommits[msg.sender] = Commit({ hash: commitHash, blockNumber: block.number });
        publicEscrow[msg.sender] += msg.value;

        emit PublicCommitted(msg.sender, msg.value);
    }

    /// @notice External entry: reveal to any recipient (e.g., smart wallet or user EOA).
    function mintFor(address recipient, bytes32 secret) external nonReentrant {
        _mintForImpl(msg.sender, recipient, secret);
    }

    /// @dev Back-compat alias that calls same private impl.
    function revealPublicFor(address recipient, bytes32 secret) external nonReentrant {
        _mintForImpl(msg.sender, recipient, secret);
    }

    /// @dev Single implementation for external nonReentrant entries (OZ best practice).
    function _mintForImpl(address committer, address recipient, bytes32 secret) private {
        require(saleState == SaleState.PublicSale, "Public sale is not active");
        require(recipient != address(0), "recipient=0");

        Commit memory c = publicCommits[committer];
        require(_existsCommit(c), "No commit");
        require(block.number >= _earliestReveal(c), "Reveal too early");
        require(block.number <= _expiryBlock(c), "Commit expired");
        require(keccak256(abi.encode(secret)) == c.hash, "Invalid secret");

        uint256 escrow = publicEscrow[committer];
        require(escrow == MINT_PRICE, "Escrow mismatch");

        delete publicCommits[committer];
        delete publicEscrow[committer];

        _mintRandom(recipient, secret);
    }

    //  CANCEL PATHS

    /// @notice User cancels their own presale commit (lenient: anytime).
    function cancelAirdropCommit() external nonReentrant {
        Commit memory c = airdropCommits[msg.sender];
        require(_existsCommit(c), "No commit");
        // Strict policy alternative:
        // require(_isExpired(c), "Not expired");
        delete airdropCommits[msg.sender];
        emit CommitCancelled(msg.sender, false, 0);
    }

    /// @notice Owner can force-cancel an expired presale commit.
    function ownerCancelExpiredAirdrop(address user) external onlyOwner nonReentrant {
        Commit memory c = airdropCommits[user];
        require(_existsCommit(c), "No commit");
        require(_isExpired(c), "Not expired");
        delete airdropCommits[user];
        emit CommitCancelled(user, false, 0);
    }

    /// @notice User cancels their own public commit and gets a refund (lenient: anytime).
    function cancelPublicCommit() external nonReentrant {
        Commit memory c = publicCommits[msg.sender];
        require(_existsCommit(c), "No commit");
        uint256 refund = publicEscrow[msg.sender];

        // Strict policy alternative:
        // require(_isExpired(c), "Not expired");

        delete publicCommits[msg.sender];
        delete publicEscrow[msg.sender];

        (bool ok, ) = payable(msg.sender).call{value: refund}("");
        require(ok, "Refund failed");
        emit CommitCancelled(msg.sender, true, refund);
    }

    /// @notice Owner can force-cancel an expired public commit and refund the user.
    function ownerCancelExpiredPublic(address user) external onlyOwner nonReentrant {
        Commit memory c = publicCommits[user];
        require(_existsCommit(c), "No commit");
        require(_isExpired(c), "Not expired");

        uint256 refund = publicEscrow[user];
        delete publicCommits[user];
        delete publicEscrow[user];

        (bool ok, ) = payable(user).call{value: refund}("");
        require(ok, "Refund failed");
        emit CommitCancelled(user, true, refund);
    }

    //  CORE MINT & RARITY LOGIC (with SSTORE2 persistence at mint)

    function _mintRandom(address to, bytes32 secret) internal {
        require(totalMinted < MAX_SUPPLY, "All tokens have been minted");

        uint256 remaining = MAX_SUPPLY - totalMinted;
        bytes32 randomHash = keccak256(
            abi.encodePacked(blockhash(block.number - 1), to, totalMinted, secret)
        );

        uint256 randomIndex = uint256(randomHash) % remaining;
        uint256 assignedTokenId = (tokenMatrix[randomIndex] == 0 && randomIndex < MAX_SUPPLY)
            ? randomIndex
            : tokenMatrix[randomIndex];

        uint256 lastIndex = remaining - 1;
        uint256 lastTokenId = (tokenMatrix[lastIndex] == 0 && lastIndex < MAX_SUPPLY)
            ? lastIndex
            : tokenMatrix[lastIndex];

        tokenMatrix[randomIndex] = lastTokenId;

        uint256 rarityRoll = uint256(keccak256(abi.encodePacked(randomHash, "RARITY"))) % 10000;

        Rarity rarity;
        if (rarityRoll < 10) {
            rarity = Rarity.Legendary;         // 0.1%
        } else if (rarityRoll < 500) {
            rarity = Rarity.Rare;              // 4.9%
        } else if (rarityRoll < 2500) {
            rarity = Rarity.Uncommon;          // 20%
        } else {
            rarity = Rarity.Common;            // 75%
        }
        tokenRarity[assignedTokenId] = rarity;

        totalMinted++;
        _safeMint(to, assignedTokenId);

        // --- NEW: persist the final SVG at mint using SSTORE2 (one-shot seal)
        string memory svg;
        if (rarity == Rarity.Legendary)      svg = _generateLegendarySVG(assignedTokenId);
        else if (rarity == Rarity.Rare)      svg = _generateRareSVG(assignedTokenId);
        else if (rarity == Rarity.Uncommon)  svg = _generateUncommonSVG(assignedTokenId);
        else                                  svg = _generateCommonSVG(assignedTokenId);

        _persistSVG(assignedTokenId, svg);

        if (totalMinted >= MAX_SUPPLY) {
            saleState = SaleState.SoldOut;
        }

        emit Minted(to, assignedTokenId, rarity);
    }

    //  WITHDRAWAL & UTILITIES

    receive() external payable {}

    function withdraw() external nonReentrant {
        uint256 amount = withdrawBalance[msg.sender];
        require(amount > 0, "Nothing to withdraw");
        withdrawBalance[msg.sender] = 0;
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Withdrawal failed");
    }

    function multicallTransfer(address to, uint256[] calldata tokenIds) external nonReentrant {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            safeTransferFrom(msg.sender, to, tokenIds[i]);
        }
    }

    //  ON-CHAIN METADATA & GENERATIVE ART
    //  Now prefers sealed SVG (SSTORE2) if present; falls back to deterministic generator.

    /// @notice Public accessor to read the persisted SVG (falls back to generated).
    function tokenSVG(uint256 tokenId) external view returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        string memory sealedSvg = _readSVG(tokenId);
        if (bytes(sealedSvg).length != 0) return sealedSvg;

        Rarity r = tokenRarity[tokenId];
        if (r == Rarity.Legendary)      return _generateLegendarySVG(tokenId);
        if (r == Rarity.Rare)           return _generateRareSVG(tokenId);
        if (r == Rarity.Uncommon)       return _generateUncommonSVG(tokenId);
        return _generateCommonSVG(tokenId);
    }

    /// @notice One-shot seal for previously minted tokens (owner or token owner).
    function sealTokenSVG(uint256 tokenId) external {
        address owner_ = _ownerOf(tokenId);
        require(owner_ != address(0), "Token does not exist");
        require(msg.sender == owner() || msg.sender == owner_, "Not authorized");
        require(_svgPtr[tokenId] == address(0), "Already sealed");

        string memory svg;
        Rarity r = tokenRarity[tokenId];
        if (r == Rarity.Legendary)      svg = _generateLegendarySVG(tokenId);
        else if (r == Rarity.Rare)      svg = _generateRareSVG(tokenId);
        else if (r == Rarity.Uncommon)  svg = _generateUncommonSVG(tokenId);
        else                             svg = _generateCommonSVG(tokenId);

        _persistSVG(tokenId, svg);
    }

    /// @dev Read sealed SVG from SSTORE2 (returns "" if not sealed).
    function _readSVG(uint256 tokenId) internal view returns (string memory) {
        address ptr = _svgPtr[tokenId];
        if (ptr == address(0)) return "";
        bytes memory raw = SSTORE2.read(ptr);
        return string(raw);
    }

    /// @dev Seal SVG via SSTORE2 (no-op if already sealed).
    function _persistSVG(uint256 tokenId, string memory svg) internal {
        if (_svgPtr[tokenId] != address(0)) return;
        address ptr = SSTORE2.write(bytes(svg));
        _svgPtr[tokenId] = ptr;
        emit TokenSVGPersisted(tokenId, bytes(svg).length);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");

        Rarity rarity = tokenRarity[tokenId];
        string memory rarityString = _rarityToString(rarity);

        string memory svg = _readSVG(tokenId);
        if (bytes(svg).length == 0) {
            // Fallback for any unsealed legacy token
            if (rarity == Rarity.Legendary)      svg = _generateLegendarySVG(tokenId);
            else if (rarity == Rarity.Rare)      svg = _generateRareSVG(tokenId);
            else if (rarity == Rarity.Uncommon)  svg = _generateUncommonSVG(tokenId);
            else                                  svg = _generateCommonSVG(tokenId);
        }

        string memory json = Base64.encode(
            bytes(
                string(
                    abi.encodePacked(
                        '{"name":"Generative NFT #', tokenId.toString(), '",',
                        '"description":"An on-chain generative NFT with algorithmic rarity.",',
                        '"attributes":[{"trait_type":"Rarity","value":"', rarityString, '"}],',
                        '"image":"data:image/svg+xml;base64,', Base64.encode(bytes(svg)), '"}'
                    )
                )
            )
        );
        return string(abi.encodePacked("data:application/json;base64,", json));
    }

    // SVG helpers (unchanged)

    function _generateCommonSVG(uint256 tokenId) internal pure returns (string memory) {
        string memory hue1 = ((tokenId * 37) % 360).toString();
        string memory hue2 = ((tokenId * 53) % 360).toString();
        return string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300">',
            '<defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">',
            '<stop offset="0%" stop-color="hsl(', hue1, ',80%,50%)" />',
            '<stop offset="100%" stop-color="hsl(', hue2, ',80%,50%)" />',
            '</linearGradient></defs>',
            '<rect width="100%" height="100%" fill="url(#g)" />',
            '</svg>'
        ));
    }

    function _generateUncommonSVG(uint256 tokenId) internal pure returns (string memory) {
        string memory hue1 = ((tokenId * 41) % 360).toString();
        string memory hue2 = ((tokenId * 59) % 360).toString();
        return string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300">',
            '<defs><radialGradient id="g" cx="50%" cy="50%" r="70%">',
            '<stop offset="0%" stop-color="hsl(', hue1, ',85%,65%)" />',
            '<stop offset="100%" stop-color="hsl(', hue2, ',85%,45%)" />',
            '</radialGradient></defs>',
            '<rect width="100%" height="100%" fill="hsl(', hue2, ',85%,25%)" />',
            '<rect width="100%" height="100%" fill="url(#g)" />',
            '</svg>'
        ));
    }

    function _generateRareSVG(uint256 tokenId) internal pure returns (string memory) {
        string memory hue = ((tokenId * 43) % 360).toString();
        string memory angle = ((tokenId * 7) % 90).toString();
        return string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300">',
            '<defs><pattern id="p" width="20" height="20" patternUnits="userSpaceOnUse" patternTransform="rotate(', angle, ')">',
            '<line x1="10" y1="0" x2="10" y2="20" stroke="hsl(', hue, ',80%,50%)" stroke-width="2"/>',
            '</pattern></defs>',
            '<rect width="100%" height="100%" fill="hsl(', hue, ',80%,20%)" />',
            '<rect width="100%" height="100%" fill="url(#p)" />',
            '</svg>'
        ));
    }

    function _generateLegendarySVG(uint256 tokenId) internal pure returns (string memory) {
        string memory hue = ((tokenId * 47) % 360).toString();
        return string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" style="background-color:black;">',
            '<defs><filter id="f"><feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="4" seed="', tokenId.toString(), '"/></filter>',
            '<radialGradient id="g"><stop offset="60%" stop-color="hsl(', hue, ',100%,70%)"/><stop offset="100%" stop-color="hsl(', hue, ',100%,0%)"/></radialGradient></defs>',
            '<rect width="100%" height="100%" filter="url(#f)" opacity="0.4"/>',
            '<circle cx="150" cy="150" r="120" fill="url(#g)"><animate attributeName="r" from="100" to="130" dur="4s" repeatCount="indefinite" begin="0s" calcMode="spline" keySplines="0.42 0 0.58 1; 0.42 0 0.58 1"/>',
            '</circle></svg>'
        ));
    }

    function _rarityToString(Rarity rarity) internal pure returns (string memory) {
        if (rarity == Rarity.Legendary) return "Legendary";
        if (rarity == Rarity.Rare) return "Rare";
        if (rarity == Rarity.Uncommon) return "Uncommon";
        return "Common";
    }

}
