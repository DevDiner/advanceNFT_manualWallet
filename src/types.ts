

export enum SaleState {
    Closed,
    Airdrop,
    PublicSale,
    SoldOut
}

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

// Interfaces for the new portfolio feature
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
    tokenStandard: 'ERC721' | 'ERC1155';
    balance?: string;
}

// Types for rich NFT metadata modal 
export interface NftAttribute {
    trait_type: string;
    value: string | number;
}

export interface NftMetadata {
    name: string;
    description: string;
    image: string;
    attributes: NftAttribute[];
    tokenStandard: 'ERC721' | 'ERC1155';
    balance?: string;
}
