// FIX: Removed the triple-slash directive for "vite/client" which was causing a type resolution error.
// The necessary types for `import.meta.env` are explicitly defined below,
// ensuring the application continues to type-check correctly.

declare global {
    interface Window {
      // ethereum?: MetaMaskInpageProvider; // preferred (with types installed)
      ethereum?: any;                       // fallback without extra types
    }
  
    interface ImportMetaEnv {
      readonly VITE_NETWORK: string;
      readonly VITE_SEPOLIA_RPC_URL: string;
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