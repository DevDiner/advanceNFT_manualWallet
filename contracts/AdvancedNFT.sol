// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/structs/BitMaps.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import { SSTORE2 } from "solmate/src/utils/SSTORE2.sol";

contract AdvancedNFT is ERC721, Ownable, ReentrancyGuard {
    using BitMaps for BitMaps.BitMap;
    using Strings for uint256;

    //  Sale / Supply 
    enum SaleState { Closed, Presale, PublicSale, SoldOut }
    SaleState public saleState;

    uint256 public constant MAX_SUPPLY = 1000;
    uint256 public constant MINT_PRICE = 0.01 ether;

    uint256 public constant REVEAL_DELAY  = 10;
    uint256 public constant REVEAL_WINDOW = 7200;

    uint256 public totalMinted;

    //  Rarity & SVG 
    enum Rarity { Common, Uncommon, Rare, Legendary }
    mapping(uint256 => Rarity) public tokenRarity;

    mapping(uint256 => address) private _svgPtr;
    event TokenSVGPersisted(uint256 indexed tokenId, uint256 numBytes);

    //  Commit-Reveal 
    struct Commit { bytes32 hash; uint256 blockNumber; }

    mapping(address => Commit) public airdropCommits;
    mapping(address => Commit) public publicCommits;

    mapping(address => uint256) public publicEscrow;

    // Airdrop allowlist
    bytes32 public immutable merkleRoot;
    BitMaps.BitMap private claimedBitmap;
    mapping(uint256 => bool) public claimedMap;
    bool public useBitmapForAirdrop; // keep your original toggle

    // random assignment
    mapping(uint256 => uint256) private tokenMatrix;

    // Splitter (manual pull) 
    // releasable = (totalReceived * shares / totalShares) - released
    address[] private _payees;
    mapping(address => uint256) public shares;
    uint256 public totalShares;
    mapping(address => uint256) public released;
    uint256 public totalReleased;

    event PayeeAdded(address indexed account, uint256 shares);
    event PaymentReleased(address indexed to, uint256 amount);

    //  Events 
    event Minted(address indexed minter, uint256 indexed tokenId, Rarity rarity);
    event CommitCancelled(address indexed user, bool indexed isPublic, uint256 refund);
    event PublicCommitted(address indexed user, uint256 value);

    //  Constructor 
    constructor(
        bytes32 _merkleRoot,
        address[] memory contributors,
        uint256[] memory contributorShares
    ) ERC721("Advanced Generative NFT", "AGNFT") Ownable(msg.sender) {
        merkleRoot = _merkleRoot;

        require(contributors.length == contributorShares.length, "Splitter: length mismatch");
        uint256 _totalShares;
        for (uint256 i = 0; i < contributors.length; i++) {
            address p = contributors[i];
            uint256 s = contributorShares[i];
            require(p != address(0), "Splitter: payee=0");
            require(s > 0, "Splitter: shares=0");
            require(shares[p] == 0, "Splitter: duplicate");
            _payees.push(p);
            shares[p] = s;
            _totalShares += s;
            emit PayeeAdded(p, s);
        }
        totalShares = _totalShares;

        saleState = SaleState.Closed;
    }

    //  Admin 
    function setSaleState(SaleState newState) external onlyOwner {
        saleState = newState;
    }

    function setUseBitmap(bool on) external onlyOwner {
        useBitmapForAirdrop = on;
    }

    //  Reveal window helpers 
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

    //  Read helpers (keep ABI) 
    function getAirdropCommit(address user)
        external view
        returns (bytes32 hash, uint256 blockNumber, uint256 earliestRevealBlock, uint256 expiryBlock, bool expired)
    {
        Commit memory c = airdropCommits[user];
        if (!_existsCommit(c)) return (bytes32(0), 0, 0, 0, false);
        return (c.hash, c.blockNumber, _earliestReveal(c), _expiryBlock(c), _isExpired(c));
    }

    // **ABI-compatible** with original (includes escrow as 6th return)
    function getPublicCommit(address user)
        external view
        returns (bytes32 hash, uint256 blockNumber, uint256 earliestRevealBlock, uint256 expiryBlock, bool expired, uint256 escrow)
    {
        Commit memory c = publicCommits[user];
        if (!_existsCommit(c)) return (bytes32(0), 0, 0, 0, false, 0);
        return (c.hash, c.blockNumber, _earliestReveal(c), _expiryBlock(c), _isExpired(c), publicEscrow[user]);
    }

    //  Airdrop (Presale) 
    /// commit: keccak256(abi.encode(secret))
    function commitAirdrop(bytes32 commitHash) external nonReentrant {
        require(saleState == SaleState.Presale, "Presale not active");
        require(airdropCommits[msg.sender].hash == bytes32(0), "Already committed");
        airdropCommits[msg.sender] = Commit({ hash: commitHash, blockNumber: block.number });
    }

    function revealAirdrop(
        uint256 index,
        bytes32 secret,
        bytes32[] calldata proof
    ) external nonReentrant {
        require(saleState == SaleState.Presale, "Presale not active");

        Commit memory c = airdropCommits[msg.sender];
        require(_existsCommit(c), "No commit");
        require(block.number >= _earliestReveal(c), "Too early");
        require(block.number <= _expiryBlock(c), "Expired");
        require(keccak256(abi.encode(secret)) == c.hash, "Bad secret");

        bytes32 leaf = keccak256(abi.encodePacked(index, msg.sender));
        require(MerkleProof.verify(proof, merkleRoot, leaf), "Bad proof");

        if (useBitmapForAirdrop) {
            require(!claimedBitmap.get(index), "Claimed");
            claimedBitmap.set(index);
        } else {
            require(!claimedMap[index], "Claimed");
            claimedMap[index] = true;
        }

        delete airdropCommits[msg.sender];
        _mintRandom(msg.sender, secret);
    }

    //  Public (paid) 
    function commitPublic(bytes32 commitHash) external payable nonReentrant {
        require(saleState == SaleState.PublicSale, "Public sale not active");
        require(publicCommits[msg.sender].hash == bytes32(0), "Already committed");
        require(msg.value == MINT_PRICE, "Wrong price");

        publicCommits[msg.sender] = Commit({ hash: commitHash, blockNumber: block.number });
        publicEscrow[msg.sender] += msg.value;

        emit PublicCommitted(msg.sender, msg.value);
    }

    function mintFor(address recipient, bytes32 secret) external nonReentrant {
        _mintForImpl(msg.sender, recipient, secret);
    }

    function revealPublicFor(address recipient, bytes32 secret) external nonReentrant {
        _mintForImpl(msg.sender, recipient, secret);
    }

    function _mintForImpl(address committer, address recipient, bytes32 secret) private {
        require(saleState == SaleState.PublicSale, "Public sale not active");
        require(recipient != address(0), "recipient=0");

        Commit memory c = publicCommits[committer];
        require(_existsCommit(c), "No commit");
        require(block.number >= _earliestReveal(c), "Too early");
        require(block.number <= _expiryBlock(c), "Expired");
        require(keccak256(abi.encode(secret)) == c.hash, "Bad secret");

        uint256 escrow = publicEscrow[committer];
        require(escrow == MINT_PRICE, "Escrow mismatch");

        delete publicCommits[committer];
        delete publicEscrow[committer];

        _mintRandom(recipient, secret);
    }

    //  Cancels 
    function cancelAirdropCommit() external nonReentrant {
        Commit memory c = airdropCommits[msg.sender];
        require(_existsCommit(c), "No commit");
        delete airdropCommits[msg.sender];
        emit CommitCancelled(msg.sender, false, 0);
    }

    function ownerCancelExpiredAirdrop(address user) external onlyOwner nonReentrant {
        Commit memory c = airdropCommits[user];
        require(_existsCommit(c), "No commit");
        require(_isExpired(c), "Not expired");
        delete airdropCommits[user];
        emit CommitCancelled(user, false, 0);
    }

    function cancelPublicCommit() external nonReentrant {
        Commit memory c = publicCommits[msg.sender];
        require(_existsCommit(c), "No commit");
        uint256 refund = publicEscrow[msg.sender];
        delete publicCommits[msg.sender];
        delete publicEscrow[msg.sender];
        (bool ok, ) = payable(msg.sender).call{value: refund}("");
        require(ok, "Refund failed");
        emit CommitCancelled(msg.sender, true, refund);
    }

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

    // Mint core 
    function _mintRandom(address to, bytes32 secret) internal {
        require(totalMinted < MAX_SUPPLY, "Sold out");

        uint256 remaining = MAX_SUPPLY - totalMinted;
        bytes32 h = keccak256(abi.encodePacked(blockhash(block.number - 1), to, totalMinted, secret));
        uint256 ri = uint256(h) % remaining;

        uint256 tokenId = (tokenMatrix[ri] == 0 && ri < MAX_SUPPLY) ? ri : tokenMatrix[ri];
        uint256 li = remaining - 1;
        uint256 lastId = (tokenMatrix[li] == 0 && li < MAX_SUPPLY) ? li : tokenMatrix[li];
        tokenMatrix[ri] = lastId;

        uint256 roll = uint256(keccak256(abi.encodePacked(h, "RARITY"))) % 10000;
        Rarity rar = Rarity.Common;
        if (roll < 10) rar = Rarity.Legendary;
        else if (roll < 500) rar = Rarity.Rare;
        else if (roll < 2500) rar = Rarity.Uncommon;

        tokenRarity[tokenId] = rar;

        totalMinted++;
        _safeMint(to, tokenId);

        string memory svg;
        if (rar == Rarity.Legendary)      svg = _generateLegendarySVG(tokenId);
        else if (rar == Rarity.Rare)      svg = _generateRareSVG(tokenId);
        else if (rar == Rarity.Uncommon)  svg = _generateUncommonSVG(tokenId);
        else                               svg = _generateCommonSVG(tokenId);
        _persistSVG(tokenId, svg);

        if (totalMinted >= MAX_SUPPLY) saleState = SaleState.SoldOut;

        emit Minted(to, tokenId, rar);
    }

    //  Splitter (pull) 
    receive() external payable {}

    function totalReceived() public view returns (uint256) {
        return address(this).balance + totalReleased;
    }

    function pendingPayment(address account) public view returns (uint256) {
        uint256 s = shares[account];
        if (s == 0) return 0;
        uint256 _totalReceived = totalReceived();
        uint256 alreadyReleased = released[account];
        return (_totalReceived * s) / totalShares - alreadyReleased;
    }

    function release(address payable account) public nonReentrant {
        require(shares[account] > 0, "No shares");
        uint256 payment = pendingPayment(account);
        require(payment > 0, "Nothing due");

        released[account] += payment;
        totalReleased     += payment;

        (bool ok, ) = account.call{value: payment}("");
        require(ok, "Transfer failed");
        emit PaymentReleased(account, payment);
    }

    // Utils / Metadata 
    function multicallTransfer(address to, uint256[] calldata tokenIds) external nonReentrant {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            safeTransferFrom(msg.sender, to, tokenIds[i]);
        }
    }

    function tokenSVG(uint256 tokenId) external view returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        string memory svgData = _readSVG(tokenId);
        if (bytes(svgData).length != 0) return svgData;

        Rarity r = tokenRarity[tokenId];
        if (r == Rarity.Legendary)      return _generateLegendarySVG(tokenId);
        if (r == Rarity.Rare)           return _generateRareSVG(tokenId);
        if (r == Rarity.Uncommon)       return _generateUncommonSVG(tokenId);
        return _generateCommonSVG(tokenId);
    }

    function sealTokenSVG(uint256 tokenId) external {
        address owner_ = _ownerOf(tokenId);
        require(owner_ != address(0), "Token does not exist");
        require(msg.sender == owner() || msg.sender == owner_, "Not authorized");
        require(_svgPtr[tokenId] == address(0), "Already sealed");

        Rarity r = tokenRarity[tokenId];
        string memory svg;
        if (r == Rarity.Legendary)      svg = _generateLegendarySVG(tokenId);
        else if (r == Rarity.Rare)      svg = _generateRareSVG(tokenId);
        else if (r == Rarity.Uncommon)  svg = _generateUncommonSVG(tokenId);
        else                             svg = _generateCommonSVG(tokenId);

        _persistSVG(tokenId, svg);
    }

    function _readSVG(uint256 tokenId) internal view returns (string memory) {
        address ptr = _svgPtr[tokenId];
        if (ptr == address(0)) return "";
        bytes memory raw = SSTORE2.read(ptr);
        return string(raw);
    }

    function _persistSVG(uint256 tokenId, string memory svg) internal {
        if (_svgPtr[tokenId] != address(0)) return;
        address ptr = SSTORE2.write(bytes(svg));
        _svgPtr[tokenId] = ptr;
        emit TokenSVGPersisted(tokenId, bytes(svg).length);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        Rarity r = tokenRarity[tokenId];

        string memory svg = _readSVG(tokenId);
        if (bytes(svg).length == 0) {
            if (r == Rarity.Legendary)      svg = _generateLegendarySVG(tokenId);
            else if (r == Rarity.Rare)      svg = _generateRareSVG(tokenId);
            else if (r == Rarity.Uncommon)  svg = _generateUncommonSVG(tokenId);
            else                             svg = _generateCommonSVG(tokenId);
        }

        string memory json = Base64.encode(
            bytes(
                string(
                    abi.encodePacked(
                        '{"name":"Generative NFT #', tokenId.toString(), '",',
                        '"description":"An on-chain generative NFT with algorithmic rarity.",',
                        '"attributes":[{"trait_type":"Rarity","value":"', _rarityToString(r), '"}],',
                        '"image":"data:image/svg+xml;base64,', Base64.encode(bytes(svg)), '"}'
                    )
                )
            )
        );
        return string(abi.encodePacked("data:application/json;base64,", json));
    }

    //  SVG helpers 
    function _generateCommonSVG(uint256 tokenId) internal pure returns (string memory) {
        string memory hue1 = ((tokenId * 37) % 360).toString();
        string memory hue2 = ((tokenId * 53) % 360).toString();
        return string(
            abi.encodePacked(
                '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">',
                '<stop offset="0%" stop-color="hsl(', hue1, ',80%,50%)"/><stop offset="100%" stop-color="hsl(', hue2, ',80%,50%)"/></linearGradient></defs>',
                '<rect width="100%" height="100%" fill="url(#g)"/></svg>'
            )
        );
    }
    function _generateUncommonSVG(uint256 tokenId) internal pure returns (string memory) {
        string memory hue1 = ((tokenId * 41) % 360).toString();
        string memory hue2 = ((tokenId * 59) % 360).toString();
        return string(
            abi.encodePacked(
                '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><defs><radialGradient id="g" cx="50%" cy="50%" r="70%">',
                '<stop offset="0%" stop-color="hsl(', hue1, ',85%,65%)"/><stop offset="100%" stop-color="hsl(', hue2, ',85%,45%)"/></radialGradient></defs>',
                '<rect width="100%" height="100%" fill="hsl(', hue2, ',85%,25%)"/><rect width="100%" height="100%" fill="url(#g)"/></svg>'
            )
        );
    }
    function _generateRareSVG(uint256 tokenId) internal pure returns (string memory) {
        string memory hue = ((tokenId * 43) % 360).toString();
        string memory angle = ((tokenId * 7) % 90).toString();
        return string(
            abi.encodePacked(
                '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><defs><pattern id="p" width="20" height="20" patternUnits="userSpaceOnUse" patternTransform="rotate(',
                angle,
                ')"><line x1="10" y1="0" x2="10" y2="20" stroke="hsl(',
                hue,
                ',80%,50%)" stroke-width="2"/></pattern></defs>',
                '<rect width="100%" height="100%" fill="hsl(', hue, ',80%,20%)"/><rect width="100%" height="100%" fill="url(#p)"/></svg>'
            )
        );
    }
    function _generateLegendarySVG(uint256 tokenId) internal pure returns (string memory) {
        string memory hue = ((tokenId * 47) % 360).toString();
        return string(
            abi.encodePacked(
                '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" style="background-color:black;"><defs>',
                '<filter id="f"><feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="4" seed="',
                tokenId.toString(),
                '"/></filter><radialGradient id="g"><stop offset="60%" stop-color="hsl(',
                hue,
                ',100%,70%)"/><stop offset="100%" stop-color="hsl(',
                hue,
                ',100%,0%)"/></radialGradient></defs>',
                '<rect width="100%" height="100%" filter="url(#f)" opacity="0.4"/><circle cx="150" cy="150" r="120" fill="url(#g)">',
                '<animate attributeName="r" from="100" to="130" dur="4s" repeatCount="indefinite"/></circle></svg>'
            )
        );
    }
    function _rarityToString(Rarity rarity) internal pure returns (string memory) {
        if (rarity == Rarity.Legendary) return "Legendary";
        if (rarity == Rarity.Rare) return "Rare";
        if (rarity == Rarity.Uncommon) return "Uncommon";
        return "Common";
    }
}
