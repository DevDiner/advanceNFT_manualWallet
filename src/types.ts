// import { ethers } from 'ethers';

// declare module '*.json' {
//     const value: any;
//     export default value;
// }

// declare global {
//     interface Window {
//         ethereum?: any;
//     }
//     interface ImportMetaEnv {
//         readonly VITE_NETWORK: string;
//         readonly VITE_SEPOLIA_RPC_URL: string;
//         readonly VITE_RELAYER_URL: string;
//         readonly VITE_NFT_ADDRESS: string;
//         readonly VITE_FACTORY_ADDRESS: string;
//         readonly VITE_ETHERSCAN_API_KEY: string;
//         readonly VITE_MAINNET_RPC_URL: string;
//     }
//     interface ImportMeta {
//         readonly env: ImportMetaEnv;
//     }
// }

// export enum SaleState {
//     Closed,
//     Airdrop,
//     PublicSale,
//     SoldOut
// }

// // UPDATE: A structured type for the full, rich metadata of the last minted NFT.
// export interface NftPreview {
//     image: string;
//     name: string;
//     description: string;
//     tokenId: string;
//     rarity: string;
//     contractAddress: string;
// }

// export type NFTDisplayProps = {
//     mintedCount: number;
//     maxSupply: number;
//     saleState: SaleState;
//     isLoading: boolean;
//     mintPrice: string;
//     nftPreviewData: NftPreview | null;
//     onRefresh: () => Promise<void>;
// };

// export type MintingInterfaceProps = {
//     account: string | null;
//     smartWalletAddress: string | null;
//     saleState: SaleState;
//     onMintSuccess: () => Promise<void>;
//     mintPrice: string;
// };

// export interface WalletViewProps {
//     account: string;
//     smartWalletAddress: string | null;
// }

// export interface RelayerDemoProps {
//     account: string;
//     smartWalletAddress: string;
// }

// // Interfaces for the new portfolio feature
// export interface Erc20Token {
//     name: string;
//     symbol: string;
//     balance: string;
//     contractAddress: string;
// }

// export interface Nft {
//     tokenId: string;
//     imageUri: string | null;
//     name: string;
//     contractAddress: string;
//     // --- NEW ---
//     tokenStandard: 'ERC721' | 'ERC1155';
//     balance?: string;
// }

// // --- NEW: Types for rich NFT metadata modal ---
// export interface NftAttribute {
//     trait_type: string;
//     value: string | number;
// }

// export interface NftMetadata {
//     name: string;
//     description: string;
//     image: string;
//     attributes: NftAttribute[];
//     // --- NEW ---
//     tokenStandard: 'ERC721' | 'ERC1155';
//     balance?: string;
// }

export enum SaleState {
    Closed,
    Airdrop,
    PublicSale,
    SoldOut,
  }
  
  // Rich preview for the latest minted NFT
  export interface NftPreview {
    image: string;
    name: string;
    description: string;
    tokenId: string;
    rarity: string;
    contractAddress: string;
  }
  
  export type NFTDisplayProps = {
    mintedCount: number;
    maxSupply: number;
    saleState: SaleState;
    isLoading: boolean;
    mintPrice: string;
    nftPreviewData: NftPreview | null;
    onRefresh: () => Promise<void>;
  };
  
  export type MintingInterfaceProps = {
    account: string | null;
    smartWalletAddress: string | null;
    saleState: SaleState;
    onMintSuccess: () => Promise<void>;
    mintPrice: string;
  };
  
  export interface WalletViewProps {
    account: string;
    smartWalletAddress: string | null;
  }
  
  export interface RelayerDemoProps {
    account: string;
    smartWalletAddress: string;
  }
  
  // Portfolio models
  export interface Erc20Token {
    name: string;
    symbol: string;
    balance: string;
    contractAddress: string;
  }
  
  export interface Nft {
    tokenId: string;
    imageUri: string | null;
    name: string;
    contractAddress: string;
    tokenStandard: "ERC721" | "ERC1155";
    balance?: string;
  }
  
  // Rich NFT metadata
  export interface NftAttribute {
    trait_type: string;
    value: string | number;
  }
  
  export interface NftMetadata {
    name: string;
    description: string;
    image: string;
    attributes: NftAttribute[];
    tokenStandard: "ERC721" | "ERC1155";
    balance?: string;
  }
  