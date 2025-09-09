// This file contains the contract ABIs, which are the interfaces for interacting
// with the smart contracts' functions.

export const ADVANCED_NFT_ABI = [
    // --- Events ---
    "event Minted(address indexed minter, uint256 indexed tokenId, uint8 rarity)",
    "event CommitCancelled(address indexed user, bool indexed isPublic, uint256 refund)",
    "event PublicCommitted(address indexed user, uint256 value)",
    "event TokenSVGPersisted(uint256 indexed tokenId, uint256 numBytes)",
    "event PayeeAdded(address indexed account, uint256 shares)",
    "event PaymentReleased(address indexed to, uint256 amount)",
    "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",

    // --- Read-only (View) Functions ---
    // Sale / Supply
    "function saleState() view returns (uint8)", // Enum: 0=Closed, 1=Presale, 2=Public, 3=SoldOut
    "function totalMinted() view returns (uint256)",
    "function MAX_SUPPLY() view returns (uint256)",
    "function MINT_PRICE() view returns (uint256)",
    
    // Commit-Reveal
    "function REVEAL_DELAY() view returns (uint256)",
    "function REVEAL_WINDOW() view returns (uint256)",
    "function airdropCommits(address) view returns (bytes32 hash, uint256 blockNumber)",
    "function publicCommits(address) view returns (bytes32 hash, uint256 blockNumber)",
    "function publicEscrow(address) view returns (uint256)",
    "function getAirdropCommit(address user) view returns (tuple(bytes32 hash, uint256 blockNumber, uint256 earliestRevealBlock, uint256 expiryBlock, bool expired))",
    "function getPublicCommit(address user) view returns (tuple(bytes32 hash, uint256 blockNumber, uint256 earliestRevealBlock, uint256 expiryBlock, bool expired, uint256 escrow))",
    
    // Airdrop
    "function merkleRoot() view returns (bytes32)",
    "function useBitmapForAirdrop() view returns (bool)",
    "function claimedMap(uint256) view returns (bool)",

    // Payment Splitter
    "function totalReceived() view returns (uint256)",
    "function totalReleased() view returns (uint256)",
    "function totalShares() view returns (uint256)",
    "function shares(address payee) view returns (uint256)",
    "function released(address payee) view returns (uint256)",
    "function pendingPayment(address account) view returns (uint256)",

    // Metadata
    "function ownerOf(uint256 tokenId) view returns (address)",
    "function tokenURI(uint256 tokenId) view returns (string)",
    "function tokenSVG(uint256 tokenId) view returns (string)",
    "function tokenRarity(uint256 tokenId) view returns (uint8)", // Enum: 0=Common, 1=Uncommon, 2=Rare, 3=Legendary

    // --- State-Changing (Write) Functions ---
    // Minting
    "function commitAirdrop(bytes32 commitHash)",
    "function revealAirdrop(uint256 index, bytes32 secret, bytes32[] calldata proof)",
    "function commitPublic(bytes32 commitHash) payable",
    "function mintFor(address recipient, bytes32 secret)",
    "function revealPublicFor(address recipient, bytes32 secret)",
    "function revealPublicFrom(address committer, address recipient, bytes32 secret)",

    // Cancellations
    "function cancelAirdropCommit()",
    "function cancelPublicCommit()",
    
    // Metadata
    "function sealTokenSVG(uint256 tokenId)",

    // Utility
    "function multicallTransfer(address to, uint256[] calldata tokenIds)",

    // Payment Splitter
    "function release(address payable account)",

    // Admin (Owner only)
    "function setSaleState(uint8 newState)",
    "function setUseBitmap(bool on)",
    "function ownerCancelExpiredAirdrop(address user)",
    "function ownerCancelExpiredPublic(address user)"
];

export const SIMPLE_WALLET_ABI = [
    "function nonces(address) view returns (uint256)",
    "function executeMetaTransaction(address from, address to, uint256 value, bytes calldata data, bytes calldata signature) payable returns (bytes memory)"
];

export const SIMPLE_WALLET_FACTORY_ABI = [
    "event WalletCreated(address indexed owner, address indexed walletAddress)",
    "function walletOf(address) view returns (address)",
    "function createWallet(address owner) returns (address)"
];