// This file contains the contract ABIs, which are the interfaces for interacting
// with the smart contracts' functions.

export const ADVANCED_NFT_ABI = [
    // Events
    "event Minted(address indexed minter, uint256 indexed tokenId, uint8 rarity)",
    "event CommitCancelled(address indexed user, bool indexed isPublic, uint256 refund)",
    "event PublicCommitted(address indexed user, uint256 value)",
    "event TokenSVGPersisted(uint256 indexed tokenId, uint256 numBytes)",
    "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",

    // Read-only functions
    "function saleState() view returns (uint8)",
    "function totalMinted() view returns (uint256)",
    "function MAX_SUPPLY() view returns (uint256)",
    "function MINT_PRICE() view returns (uint256)",
    "function REVEAL_DELAY() view returns (uint256)",
    "function REVEAL_WINDOW() view returns (uint256)",
    "function ownerOf(uint256 tokenId) view returns (address)", // For brute-force check
    "function tokenURI(uint256 tokenId) view returns (string)",
    "function tokenSVG(uint256 tokenId) view returns (string)",
    "function airdropCommits(address) view returns (bytes32 hash, uint256 blockNumber)",
    "function publicCommits(address) view returns (bytes32 hash, uint256 blockNumber)",
    "function getAirdropCommit(address user) view returns (tuple(bytes32 hash, uint256 blockNumber, uint256 earliestRevealBlock, uint256 expiryBlock, bool expired))",
    "function getPublicCommit(address user) view returns (tuple(bytes32 hash, uint256 blockNumber, uint256 earliestRevealBlock, uint256 expiryBlock, bool expired, uint256 escrow))",
    
    // State-changing functions
    "function commitAirdrop(bytes32 commitHash)",
    "function revealAirdrop(uint256 index, bytes32 secret, bytes32[] calldata proof)",
    "function commitPublic(bytes32 commitHash) payable",
    "function mintFor(address recipient, bytes32 secret)",
    "function revealPublicFor(address recipient, bytes32 secret)",
    "function cancelAirdropCommit()",
    "function cancelPublicCommit()",
    "function sealTokenSVG(uint256 tokenId)"
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