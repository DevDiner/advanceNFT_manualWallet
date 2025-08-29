import { ethers } from 'ethers';

export enum SaleState {
    Closed,
    Presale,
    PublicSale,
    SoldOut
}

export type NFTDisplayProps = {
    mintedCount: number;
    maxSupply: number;
    saleState: SaleState;
    isLoading: boolean;
    mintPrice: string;
};

export type MintingInterfaceProps = {
    account: string | null;
    saleState: SaleState;
    onMintSuccess: (tokenId: ethers.BigNumberish) => void;
    mintPrice: string;
};

interface Eip1193ProviderWithEvents extends ethers.Eip1193Provider {
  on(eventName: string | symbol, listener: (...args: any[]) => void): this;
  removeListener(eventName: string | symbol, listener: (...args: any[]) => void): this;
}

declare global {
    interface Window {
        ethereum?: Eip1193ProviderWithEvents;
    }
}