// This file makes the frontend "environment-aware".
// It reliably determines the network configuration by reading the VITE_NETWORK
// environment variable, which is set by the deployment script.

import deployedAddresses from '../deployed-addresses.json';

interface NetworkConfig {
    chainId: number;
    networkName: string;
    rpcUrl?: string; // Made optional to handle missing env var gracefully
    etherscanUrl: string | null;
    etherscanApiUrl: string | null;
    etherscanApiKey: string | null;
}

// Vite exposes env variables here. These are set by the deploy script into .env.local
const env = import.meta.env;
const networkName = env.VITE_NETWORK || 'localhost'; // Default to localhost

// A centralized map for all network configurations.
// Makes adding new networks (e.g., mainnet) clean and easy.
const networkConfigs: { [key: string]: NetworkConfig } = {
    localhost: {
        chainId: 1337,
        networkName: 'Hardhat',
        rpcUrl: 'http://127.0.0.1:8545',
        etherscanUrl: null,
        etherscanApiUrl: null,
        etherscanApiKey: null,
    },
    sepolia: {
        chainId: 11155111,
        networkName: 'Sepolia',
        // FIX: Removed the fallback to the public RPC URL. The app now REQUIRES this env var.
        // This prevents the dApp from trying to use an endpoint that causes CORS errors.
        rpcUrl: env.VITE_SEPOLIA_RPC_URL,
        etherscanUrl: 'https://sepolia.etherscan.io',
        etherscanApiUrl: 'https://api.etherscan.io/v2/api',
        etherscanApiKey: env.VITE_ETHERSCAN_API_KEY || null,
    },
    // Future-proofing: Add mainnet configuration here when ready.
    mainnet: {
        chainId: 1,
        networkName: 'Ethereum Mainnet',
        rpcUrl: env.VITE_MAINNET_RPC_URL,
        etherscanUrl: 'https://etherscan.io',
        etherscanApiUrl: 'https://api.etherscan.io/v2/api',
        etherscanApiKey: env.VITE_ETHERSCAN_API_KEY || null,
    }
};

const activeNetworkConfig = networkConfigs[networkName] || networkConfigs.localhost;

const config = {
    ...activeNetworkConfig,
    contractAddress: env.VITE_NFT_ADDRESS || deployedAddresses.nft,
    factoryAddress: env.VITE_FACTORY_ADDRESS || deployedAddresses.factory,
    relayerUrl: env.VITE_RELAYER_URL || '',
    isLocalhost: networkName === 'localhost',
    activeNetworkName: networkName,
};

/**
 * Validates the application's configuration on startup.
 * Throws a user-friendly error if a required environment variable is missing for the
 * current network, preventing cryptic runtime errors like CORS issues.
 */
export function validateConfig() {
    if (config.activeNetworkName === 'sepolia' && !config.rpcUrl) {
        throw new Error("Configuration Error: The Sepolia RPC URL is missing. Please set VITE_SEPOLIA_RPC_URL in your Vercel project's Environment Variables and re-deploy the application.");
    }
    if ((config.activeNetworkName === 'sepolia' || config.activeNetworkName === 'mainnet') && !config.relayerUrl) {
        console.warn(
            "Relayer URL is not configured. Gasless transactions will fail. " +
            "Ensure the relayer URL for the live network is set in your .env file before deploying."
        );
    }
}


export default config;