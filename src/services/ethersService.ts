import { ethers } from 'ethers';
import axios from 'axios';
import { ADVANCED_NFT_ABI, SIMPLE_WALLET_FACTORY_ABI } from '../constants';
import config from '../config';
import { Erc20Token, Nft, NftMetadata } from '../types';

export const getReadOnlyProvider = (): ethers.Provider => {
    return new ethers.JsonRpcProvider(config.rpcUrl);
};

export const getProvider = (): ethers.BrowserProvider => {
    if (typeof window === 'undefined' || !window.ethereum) {
        throw new Error("No wallet found. Please install a web3 wallet like MetaMask.");
    }
    return new ethers.BrowserProvider(window.ethereum);
};

export const getSigner = async (): Promise<ethers.Signer> => {
    const provider = getProvider();
    return await provider.getSigner();
};

export const getContract = () => {
    const provider = getReadOnlyProvider();
    return new ethers.Contract(config.contractAddress, ADVANCED_NFT_ABI, provider);
};

export const getContractWithSigner = async () => {
    const signer = await getSigner();
    return new ethers.Contract(config.contractAddress, ADVANCED_NFT_ABI, signer);
};

export const getWalletFactoryContract = () => {
    const provider = getReadOnlyProvider();
    return new ethers.Contract(config.factoryAddress, SIMPLE_WALLET_FACTORY_ABI, provider);
};

export const assertContractDeployed = async () => {
    if (!config.contractAddress || !ethers.isAddress(config.contractAddress)) {
        throw new Error("Contract address is not configured.");
    }
    if (!config.factoryAddress || !ethers.isAddress(config.factoryAddress)) {
        throw new Error("Factory address is not configured.");
    }
    const provider = getReadOnlyProvider();
    const nftCode = await provider.getCode(config.contractAddress);
    const factoryCode = await provider.getCode(config.factoryAddress);
    if (nftCode === "0x" || factoryCode === "0x") {
        throw new Error(`Contracts not deployed. Please run deployment script.`);
    }
};

// Localhost NFT discovery to be more robust and efficient. This iterates through
// every possible token ID and checks ownership one by one, ensuring that if you
// own an NFT from the currently connected contract, it will be found.
export const getNftsForOwner = async (ownerAddress: string): Promise<Nft[]> => {
    const contract = getContract();
    const lowercasedOwnerAddress = ownerAddress.toLowerCase();
    const ownedTokenIds: string[] = [];
    
    try {
        const maxSupply = await contract.MAX_SUPPLY();
        const numMaxSupply = Number(maxSupply);
        
        // Use a sequential `for` loop instead of `Promise.all` for robustness.
        for (let i = 0; i < numMaxSupply; i++) {
            try {
                const owner = await contract.ownerOf(i);
                if (owner.toLowerCase() === lowercasedOwnerAddress) {
                    ownedTokenIds.push(i.toString());
                }
            } catch (error) {
                // This error is expected for tokens that are not minted yet. We can safely ignore it.
            }
        }

        if (ownedTokenIds.length === 0) return [];

        const nftPromises = ownedTokenIds.map(async (tokenId): Promise<Nft | null> => {
            try {
                const tokenURI = await contract.tokenURI(tokenId);
                const metadataJson = JSON.parse(atob(tokenURI.substring(29)));
                return {
                    tokenId: tokenId.toString(),
                    imageUri: metadataJson.image,
                    name: `AdvancedNFT #${tokenId}`,
                    contractAddress: config.contractAddress,
                    tokenStandard: 'ERC721',
                    balance: '1',
                };
            } catch (err) {
                console.warn(`Failed to fetch metadata for local NFT #${tokenId}`, err);
                return null;
            }
        });

        return (await Promise.all(nftPromises)).filter((nft): nft is Nft => nft !== null);

    } catch (e: any) {
        console.error("Brute-force NFT ownership check failed:", e);
        throw new Error("Could not perform local NFT ownership check.");
    }
};


// PORTFOLIO SERVICES (for live networks) ---

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Etherscan API Throttling
// Explicitly type the promise queue to `Promise<any>` to allow chaining
// promises with different resolved types, preventing a TypeScript error.
let etherscanApiQueue: Promise<any> = Promise.resolve();

// Etherscan's public API rate limit is 5 calls/sec, which is 200ms per call.
// A 300ms interval provides a safe buffer.
const ETHERSCAN_API_INTERVAL = 300;

const throttledAxiosGet = (url: string) => {
    // Only apply the throttle to Etherscan API calls.
    if (config.etherscanApiUrl && url.startsWith(config.etherscanApiUrl)) {
        const requestPromise = etherscanApiQueue.then(() => {
            // This promise resolves after the interval, ensuring a delay from the PREVIOUS call.
            return new Promise(resolve => setTimeout(resolve, ETHERSCAN_API_INTERVAL));
        }).then(() => {
            // Now make the actual API call.
            return axios.get(url);
        });

        // Chain the new request promise to the queue, so the NEXT call will wait for this one.
        etherscanApiQueue = requestPromise;
        return requestPromise;
    }
    
    // For non-Etherscan URLs, execute immediately without throttling.
    return axios.get(url);
};


async function axiosWithRetries(url: string, retries: number = 3, initialDelay: number = 1000) {
    let lastError: any;
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            //Use the new throttled getter instead of a direct axios call.
            const response = await throttledAxiosGet(url);
            return response;
        } catch (error: any) {
            lastError = error;
            // Don't retry on client-side errors (4xx), as they won't succeed on retry
            if (error.response && error.response.status >= 400 && error.response.status < 500) {
                console.error(`Client error on API call to ${url}: ${error.message}. No retry.`);
                throw error;
            }
            
            if (attempt < retries) {
                const delayMs = initialDelay * Math.pow(2, attempt - 1);
                console.warn(`API call to ${url} failed. Retrying in ${delayMs}ms... (Attempt ${attempt}/${retries})`);
                await delay(delayMs);
            }
        }
    }
    console.error(`API call failed after ${retries} attempts.`);
    throw lastError;
}

/**
 * A robust, universal metadata fetcher for any NFT.
 * 
 * This function is designed to support the "My Wallet" feature, which acts as a
 * universal portfolio viewer for ALL of the user's NFTs, not just those from this
 * project. It correctly handles the three most common metadata URI schemes:
 * 
 * 1. `data:application/json;base64,...` (Fully On-Chain):
 *    - This is the scheme used by this project's `AdvancedNFT` contract.
 *    - The function decodes the base64 content directly from the URI string.
 *    - This requires no external network requests.
 * 
 * 2. `ipfs://...` (Decentralized Storage):
 *    - A common standard for NFTs that store their metadata on the IPFS network.
 *    - The function resolves this to a public IPFS gateway URL (`https://ipfs.io/ipfs/...`)
 *      and fetches the metadata via a standard HTTP request.
 * 
 * 3. `https://...` (Centralized Storage):
 *    - Used by NFTs that store metadata on traditional web servers.
 *    - The function fetches this directly via a standard HTTP request.
 * 
 * By supporting all three, we ensure the portfolio viewer provides a complete and
 * accurate picture of the user's assets, regardless of where or how they were minted.
 */
async function fetchMetadata(uri: string): Promise<any> {
    if (uri.startsWith('ipfs://')) {
        uri = `https://ipfs.io/ipfs/${uri.substring(7)}`;
    } else if (uri.startsWith('data:application/json;base64,')) {
        try {
            return JSON.parse(atob(uri.substring(29)));
        } catch (e) {
            console.warn(`Could not parse base64 metadata from ${uri.substring(0, 50)}...:`, e);
            return null;
        }
    }
    try {
        const response = await axiosWithRetries(uri);
        return response.data;
    } catch (e) {
        console.warn(`Could not fetch metadata from ${uri}:`, e);
        return null;
    }
}

// This function determines token standard and handles ERC-1155 URIs.
export const fetchNftMetadata = async (contractAddress: string, tokenId: string, balance?: string): Promise<NftMetadata | null> => {
    const provider = getReadOnlyProvider();
    try {
        let tokenUri;
        let tokenStandard: 'ERC721' | 'ERC1155' = 'ERC721';
        
        try {
            const contract721 = new ethers.Contract(contractAddress, ["function tokenURI(uint256 tokenId) view returns (string)"], provider);
            tokenUri = await contract721.tokenURI(tokenId);
        } catch (e721) {
            try {
                const contract1155 = new ethers.Contract(contractAddress, ["function uri(uint26 id) view returns (string)"], provider);
                tokenUri = await contract1155.uri(tokenId);
                tokenStandard = 'ERC1155';
                
                if (tokenUri && tokenUri.includes('{id}')) {
                    const tokenIdHex = ethers.toBeHex(ethers.toBigInt(tokenId)).slice(2).padStart(64, '0');
                    tokenUri = tokenUri.replace('{id}', tokenIdHex);
                }
            } catch (e1155) {
                console.warn(`Could not fetch token URI for ${contractAddress}#${tokenId} via ERC-721 or ERC-1155.`);
                return null;
            }
        }
        
        if (!tokenUri) return null;

        const metadata = await fetchMetadata(tokenUri);
        if (metadata) {
            let imageUri = metadata.image || metadata.image_url;
            if (imageUri && imageUri.startsWith('ipfs://')) {
                imageUri = `https://ipfs.io/ipfs/${imageUri.substring(7)}`;
            }
            return {
                name: metadata.name || `Token #${tokenId}`,
                description: metadata.description || 'No description available.',
                image: imageUri,
                attributes: metadata.attributes || [],
                tokenStandard,
                balance,
            };
        }
    } catch (e) {
        console.error(`Could not fetch metadata for ${contractAddress} #${tokenId}`, e);
    }
    return null;
};

export const fetchErc721Nfts = async (ownerAddress: string): Promise<Nft[]> => {
    if (!config.etherscanApiUrl || !config.etherscanApiKey) {
        throw new Error("Etherscan API is not configured for this network.");
    }
    const lowercasedOwner = ownerAddress.toLowerCase();
    const url721 = `${config.etherscanApiUrl}?chainId=${config.chainId}&module=account&action=tokennfttx&address=${ownerAddress}&startblock=0&sort=asc&apikey=${config.etherscanApiKey}`;

    const response721 = await axiosWithRetries(url721);
    
    //  Robust Etherscan API Response Handling 
    if (response721.data.status !== "1") {
        if (response721.data.message === 'No transactions found') {
            return []; // Not an error, just no NFTs of this type.
        }
        // A genuine API error (e.g., rate limit, invalid key).
        throw new Error(`Etherscan API Error: ${response721.data.message} - ${response721.data.result}`);
    }
    
    if (!Array.isArray(response721.data.result)) {
         throw new Error("Etherscan API returned an unexpected data format.");
    }

    const ownedNfts721 = new Map<string, Nft>();
    for (const tx of response721.data.result) {
        const key = `${tx.contractAddress.toLowerCase()}-${tx.tokenID}`;
        if (tx.to.toLowerCase() === lowercasedOwner) {
            ownedNfts721.set(key, { contractAddress: tx.contractAddress, tokenId: tx.tokenID, name: tx.tokenName, imageUri: null, tokenStandard: 'ERC721', balance: '1' });
        } else if (tx.from.toLowerCase() === lowercasedOwner) {
            ownedNfts721.delete(key);
        }
    }
    
    return Array.from(ownedNfts721.values());
};


export const fetchErc1155Nfts = async (ownerAddress: string): Promise<Nft[]> => {
    if (!config.etherscanApiUrl || !config.etherscanApiKey) {
        throw new Error("Etherscan API is not configured for this network.");
    }
    const lowercasedOwner = ownerAddress.toLowerCase();
    const url1155 = `${config.etherscanApiUrl}?chainId=${config.chainId}&module=account&action=token1155tx&address=${ownerAddress}&startblock=0&sort=asc&apikey=${config.etherscanApiKey}`;
    
    const response1155 = await axiosWithRetries(url1155);

    // --- Robust Etherscan API Response Handling ---
    if (response1155.data.status !== "1") {
        if (response1155.data.message === 'No transactions found') {
            return []; // Not an error.
        }
        throw new Error(`Etherscan API Error: ${response1155.data.message} - ${response1155.data.result}`);
    }
    
    if (!Array.isArray(response1155.data.result)) {
         throw new Error("Etherscan API returned an unexpected data format.");
    }

    const nfts1155Info = new Map<string, Omit<Nft, 'tokenStandard' | 'balance'>>();
    const incoming1155 = new Map<string, bigint>();
    const outgoing1155 = new Map<string, bigint>();

    for (const tx of response1155.data.result) {
        try {
            const key = `${tx.contractAddress.toLowerCase()}-${tx.tokenID}`;
            const value = ethers.toBigInt(tx.tokenValue);

            if (!nfts1155Info.has(key)) {
                nfts1155Info.set(key, { contractAddress: tx.contractAddress, tokenId: tx.tokenID, name: tx.tokenName, imageUri: null });
            }

            if (tx.to.toLowerCase() === lowercasedOwner) {
                const currentIn = incoming1155.get(key) || 0n;
                incoming1155.set(key, currentIn + value);
            }
            if (tx.from.toLowerCase() === lowercasedOwner) {
                const currentOut = outgoing1155.get(key) || 0n;
                outgoing1155.set(key, currentOut + value);
            }
        } catch (e) {
            console.warn("Skipping malformed ERC-1155 transaction:", tx, e);
        }
    }

    const ownedNfts1155: Nft[] = [];
    for (const key of nfts1155Info.keys()) {
        const totalIn = incoming1155.get(key) || 0n;
        const totalOut = outgoing1155.get(key) || 0n;
        const balance = totalIn - totalOut;
        if (balance > 0n) {
            const nftInfo = nfts1155Info.get(key)!;
            ownedNfts1155.push({
                ...nftInfo,
                tokenStandard: 'ERC1155',
                balance: balance.toString(),
            });
        }
    }
    return ownedNfts1155;
};

export const fetchErc20Balances = async (ownerAddress: string): Promise<Erc20Token[]> => {
    if (!config.etherscanApiUrl || !config.etherscanApiKey) {
        throw new Error("Etherscan API is not configured for this network.");
    }
    const url = `${config.etherscanApiUrl}?chainId=${config.chainId}&module=account&action=tokentx&address=${ownerAddress}&startblock=0&sort=asc&apikey=${config.etherscanApiKey}`;
    const response = await axiosWithRetries(url);
    
    // --- Robust Etherscan API Response Handling ---
    if (response.data.status !== "1") {
        if (response.data.message === 'No transactions found') {
            return []; // Not an error.
        }
        throw new Error(`Etherscan API Error: ${response.data.message} - ${response.data.result}`);
    }
    
    if (!Array.isArray(response.data.result)) {
         throw new Error("Etherscan API returned an unexpected data format.");
    }

    const tokens = new Map<string, { name: string, symbol: string, decimals: number }>();
    const incoming = new Map<string, bigint>();
    const outgoing = new Map<string, bigint>();

    for (const tx of response.data.result) {
        try {
            const tokenAddress = tx.contractAddress.toLowerCase();
            const value = ethers.toBigInt(tx.value);
            
            if (!tokens.has(tokenAddress)) {
                tokens.set(tokenAddress, { name: tx.tokenName, symbol: tx.tokenSymbol, decimals: parseInt(tx.tokenDecimal) });
            }
            
            if (tx.to.toLowerCase() === ownerAddress.toLowerCase()) {
                const currentIn = incoming.get(tokenAddress) || 0n;
                incoming.set(tokenAddress, currentIn + value);
            }
            if (tx.from.toLowerCase() === ownerAddress.toLowerCase()) {
                const currentOut = outgoing.get(tokenAddress) || 0n;
                outgoing.set(tokenAddress, currentOut + value);
            }
        } catch (e) {
            console.warn("Skipping malformed ERC-20 transaction:", tx, e);
        }
    }

    const finalBalances: Erc20Token[] = [];
    const allTokenAddresses = new Set([...incoming.keys(), ...outgoing.keys()]);

    for (const address of allTokenAddresses) {
        const totalIn = incoming.get(address) || 0n;
        const totalOut = outgoing.get(address) || 0n;
        const balance = totalIn - totalOut;

        if (balance > 0n) {
            const tokenInfo = tokens.get(address)!;
            finalBalances.push({
                contractAddress: address,
                name: tokenInfo.name,
                symbol: tokenInfo.symbol,
                balance: ethers.formatUnits(balance, tokenInfo.decimals),
            });
        }
    }

    return finalBalances;
};
