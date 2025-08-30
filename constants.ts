export const CONTRACT_ADDRESS = "0xd4eCC6a45254FD00970f1ECC0066F14Df8D13bD9"; // Example: Local hardhat node address

export const CONTRACT_ABI = [
    "event Minted(address indexed minter, uint256 indexed tokenId, uint256 rarity)",
    "function saleState() view returns (uint8)",
    "function totalMinted() view returns (uint256)",
    "function MAX_SUPPLY() view returns (uint256)",
    "function MINT_PRICE() view returns (uint256)",
    "function tokenURI(uint256 tokenId) view returns (string)",
    "function airdropCommits(address) view returns (bytes32 hash, uint256 blockNumber)",
    "function publicCommits(address) view returns (bytes32 hash, uint256 blockNumber)",
    "function commitAirdrop(bytes32 commitHash)",
    "function revealAirdrop(uint256 index, bytes32 secret, bytes32[] calldata proof)",
    "function commitPublic(bytes32 commitHash) payable",
    "function revealPublic(bytes32 secret)"
];
