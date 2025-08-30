/// <reference types="vite/client" />

declare global {
    interface Window {
      // ethereum?: MetaMaskInpageProvider; // preferred (with types installed)
      ethereum?: any;                       // fallback without extra types
    }
  
    interface ImportMetaEnv {
      readonly VITE_NETWORK: string;
      readonly VITE_SEPOLIA_RPC_URL: string;
      readonly VITE_RELAYER_URL: string;
      readonly VITE_NFT_ADDRESS: string;
      readonly VITE_FACTORY_ADDRESS: string;
      readonly VITE_ETHERSCAN_API_KEY: string;
      readonly VITE_MAINNET_RPC_URL: string;
    }
  
    interface ImportMeta {
      readonly env: ImportMetaEnv;
    }
  }
  
  export {};
  