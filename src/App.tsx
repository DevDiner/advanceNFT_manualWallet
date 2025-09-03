import React, { useState, useEffect, useCallback } from 'react';
import { ethers, EventLog, Log } from 'ethers';
import axios from 'axios';

import Header from './components/Header';
import NFTDisplay from './components/NFTDisplay';
import MintingInterface from './components/MintingInterface';
import WalletView from './components/WalletView';
import { SaleState, NftPreview } from './types';
import { getContract, getReadOnlyProvider, assertContractDeployed, getWalletFactoryContract } from './services/ethersService';
import config, { validateConfig } from './config';
import Spinner from './components/shared/Spinner';
import Card from './components/shared/Card';
import Button from './components/shared/Button';
import Alert from './components/shared/Alert';


type Page = 'minter' | 'wallet';

const App: React.FC = () => {
    const [account, setAccount] = useState<string | null>(null);
    const [smartWalletAddress, setSmartWalletAddress] = useState<string | null>(null);
    const [saleState, setSaleState] = useState<SaleState>(SaleState.Closed);
    const [mintedCount, setMintedCount] = useState<number>(0);
    const [maxSupply, setMaxSupply] = useState<number>(0);
    const [mintPrice, setMintPrice] = useState<string>('0');
    const [isInitializing, setIsInitializing] = useState<boolean>(true);
    const [appError, setAppError] = useState<string | null>(null);
    const [networkError, setNetworkError] = useState<string | null>(null);
    
    const [nftPreviewData, setNftPreviewData] = useState<NftPreview | null>(null);
    
    const [currentPage, setCurrentPage] = useState<Page>('minter');
    
    const [isDeployingWallet, setIsDeployingWallet] = useState(false);
    const [deployWalletError, setDeployWalletError] = useState<string | null>(null);

    const checkNetwork = useCallback(async () => {
        try {
            if (!(window as any).ethereum) return false;
            const provider = new ethers.BrowserProvider((window as any).ethereum);
            const network = await provider.getNetwork();
            if (network.chainId !== BigInt(config.chainId)) {
                setNetworkError(`Wrong network. Please connect to ${config.networkName}.`);
                return false;
            }
            setNetworkError(null);
            return true;
        } catch (err) {
            setNetworkError("Could not verify network. Please connect wallet.");
            return false;
        }
    }, []);

    const fetchNftPreviewData = useCallback(async (tokenId: ethers.BigNumberish) => {
        try {
            const contract = getContract();
            const tokenURI = await contract.tokenURI(tokenId);
            const metadataJson = JSON.parse(atob(tokenURI.substring(29)));
            
            const rarityAttribute = metadataJson.attributes?.find(
                (attr: { trait_type: string }) => attr.trait_type === 'Rarity'
            );

            const preview: NftPreview = {
                image: metadataJson.image,
                name: metadataJson.name || `Generative NFT #${tokenId}`,
                description: metadataJson.description || "An on-chain generative NFT.",
                tokenId: tokenId.toString(),
                rarity: rarityAttribute?.value || 'Unknown',
                contractAddress: config.contractAddress,
            };
            
            setNftPreviewData(preview);
        } catch (err) {
            console.error("Failed to fetch NFT preview:", err);
            setNftPreviewData(null);
        }
    }, []);

    const fetchSmartWalletAddress = useCallback(async (currentAccount: string) => {
        try {
            const factory = getWalletFactoryContract();
            const walletAddress = await factory.walletOf(currentAccount);
            if (walletAddress && walletAddress !== ethers.ZeroAddress) {
                setSmartWalletAddress(walletAddress);
                return walletAddress;
            } else {
                setSmartWalletAddress(null);
                return null;
            }
        } catch (err) {
            console.error("Failed to fetch smart wallet address:", err);
            setSmartWalletAddress(null);
            return null;
        }
    }, []);

    const fetchContractData = useCallback(async () => {
        setAppError(null);
        try {
            const contract = getContract();
            const [state, minted, supply, price] = await Promise.all([
                contract.saleState(), contract.totalMinted(), contract.MAX_SUPPLY(), contract.MINT_PRICE(),
            ]);
            const mintedNum = Number(minted);
            setSaleState(Number(state) as SaleState);
            setMintedCount(mintedNum);
            setMaxSupply(Number(supply));
            setMintPrice(ethers.formatEther(price));

            if (mintedNum > 0) {
                const provider = getReadOnlyProvider();
                const filter = contract.filters.Minted();
                const latestBlock = await provider.getBlockNumber();
                
                // --- Chunking Strategy ---
                // This approach respects free RPC provider limits (e.g., 10-block range)
                // by breaking a large historical scan into a series of smaller, compliant requests.
                const CHUNK_SIZE = 9; 
                const MAX_BLOCKS_TO_SCAN = 500; // Look back a reasonable distance.
                let lastEvent: EventLog | Log | null = null;

                for (let i = 0; i < MAX_BLOCKS_TO_SCAN; i += (CHUNK_SIZE + 1)) {
                    const toBlock = latestBlock - i;
                    const fromBlock = Math.max(0, toBlock - CHUNK_SIZE);
                    
                    try {
                        const events = await contract.queryFilter(filter, fromBlock, toBlock);
                        if (events.length > 0) {
                            // The last event in the array is the most recent in this chunk.
                            lastEvent = events[events.length - 1];
                            break; // Exit loop once we find the most recent event.
                        }
                    } catch (e) {
                         console.warn(`Could not query block range ${fromBlock}-${toBlock}. This may be expected on some networks.`, e);
                    }

                    if (fromBlock === 0) break; // Stop if we've reached the genesis block.
                }

                if (lastEvent) {
                    // This is a pragmatic cast to bypass a complex TS inference issue where `lastEvent`
                    // can be incorrectly narrowed to `never`, despite runtime checks.
                    const eventWithArgs = lastEvent as any;
                    if (eventWithArgs.args && eventWithArgs.args.length > 1) {
                       // The `Minted` event is defined as: `event Minted(address minter, uint256 tokenId, ...)`.
                       // The `tokenId` is the second argument, accessible at index 1 of the `args` array.
                       const lastTokenId = eventWithArgs.args[1];
                       await fetchNftPreviewData(lastTokenId);
                    }
                } else {
                    console.warn(`No "Minted" event found in the last ${MAX_BLOCKS_TO_SCAN} blocks.`);
                    setNftPreviewData(null);
                }
            } else {
                 setNftPreviewData(null);
            }
        } catch (err: any) {
            console.error("Error fetching contract data:", err);
            setAppError(err.reason || "Could not load contract data.");
        }
    }, [fetchNftPreviewData]);

    const disconnectWallet = useCallback(() => {
        setAccount(null);
        setSmartWalletAddress(null);
        localStorage.removeItem('walletConnected');
    }, []);

    const connectWallet = useCallback(async () => {
        if (!(window as any).ethereum) {
            setAppError("No wallet found. Please install MetaMask.");
            return;
        }
        setAppError(null);
        try {
            const provider = new ethers.BrowserProvider((window as any).ethereum);
            const accounts = await provider.send("eth_requestAccounts", []);
            if (accounts.length > 0) {
                const userAccount = accounts[0];
                setAccount(userAccount);
                localStorage.setItem('walletConnected', 'true');
                if (await checkNetwork()) {
                    await fetchSmartWalletAddress(userAccount);
                }
            }
        } catch (err: any) {
            setAppError(err.message || "Failed to connect wallet.");
        }
    }, [checkNetwork, fetchSmartWalletAddress]);
    
    useEffect(() => {
        const initialize = async () => {
            setIsInitializing(true);
            try {
                validateConfig(); // Check for required env vars before doing anything else
                await assertContractDeployed();
                await fetchContractData();

                if ((window as any).ethereum && localStorage.getItem('walletConnected') === 'true') {
                    const provider = new ethers.BrowserProvider((window as any).ethereum);
                    const accounts = await provider.send("eth_accounts", []);

                    if (accounts.length > 0) {
                        const userAccount = accounts[0];
                        setAccount(userAccount);
                        
                        const isNetworkOk = await checkNetwork();
                        if (isNetworkOk) {
                            await fetchSmartWalletAddress(userAccount);
                        }
                    } else {
                        disconnectWallet();
                    }
                }
            } catch (err: any) {
                setAppError(err.message);
            } finally {
                setIsInitializing(false);
            }
        };
        initialize();
    }, [checkNetwork, fetchContractData, fetchSmartWalletAddress, disconnectWallet]);

    useEffect(() => {
        const ethereum = (window as any).ethereum;
        if (ethereum) {
            const handleAccountsChanged = (accounts: string[]) => {
                if (accounts.length > 0) {
                    connectWallet(); 
                } else { 
                    disconnectWallet(); 
                }
            };
            const handleChainChanged = () => window.location.reload();
            
            ethereum.on('accountsChanged', handleAccountsChanged);
            ethereum.on('chainChanged', handleChainChanged);

            return () => {
                if (ethereum.removeListener) {
                    ethereum.removeListener('accountsChanged', handleAccountsChanged);
                    ethereum.removeListener('chainChanged', handleChainChanged);
                }
            };
        }
    }, [connectWallet, disconnectWallet]);

    useEffect(() => {
        // Re-check for a smart wallet every time the user navigates to the "My Wallet" page.
        // This ensures the UI is always in sync, even if the initial check on load failed.
        if (currentPage === 'wallet' && account) {
            fetchSmartWalletAddress(account);
        }
    }, [currentPage, account, fetchSmartWalletAddress]);

    const handleCreateWallet = async () => {
        if (!account) return;
        setIsDeployingWallet(true);
        setDeployWalletError(null);
        try {
            // Use a relative path to ensure same-origin requests, fixing CORS issues.
            const response = await axios.post('/api/deploy-wallet', { owner: account });
            if (response.data.success) {
                setSmartWalletAddress(response.data.walletAddress);
            } else {
                throw new Error(response.data.error || "Failed to deploy wallet.");
            }
        } catch (err: any) {
            // --- "Self-healing" UI logic ---
            // If the relayer returns a 409 Conflict, it means the wallet already exists,
            // but our frontend state is out of sync. We can use the address from the response.
            if (axios.isAxiosError(err) && err.response?.status === 409) {
                const existingAddress = err.response.data.walletAddress;
                if (existingAddress && ethers.isAddress(existingAddress)) {
                    setSmartWalletAddress(existingAddress);
                    setDeployWalletError(null);
                } else {
                    // Fallback if the relayer's response is malformed
                    setDeployWalletError("A wallet already exists, but its address could not be retrieved. Please refresh the page.");
                }
            } else {
                const errorMessage = err.response?.data?.error || err.message || "An error occurred during deployment.";
                setDeployWalletError(errorMessage);
            }
        } finally {
            setIsDeployingWallet(false);
        }
    };

    const renderWalletCreationCTA = () => (
        <Card>
            {isDeployingWallet ? (
                <div className="flex flex-col items-center justify-center text-center p-4">
                    <Spinner />
                    <h3 className="text-xl font-bold mt-4">Deploying Your Wallet...</h3>
                    <p className="text-gray-400 mt-2">The relayer is processing your request. This may take a minute.</p>
                </div>
            ) : (
                <div className="flex flex-col text-center">
                    <h2 className="text-2xl font-bold text-white mb-2">Create Your Smart Wallet</h2>
                    <p className="text-gray-400 mb-6">
                        Create a personal smart contract wallet to enable gasless transactions and manage your assets. The deployment is sponsored by our relayer.
                    </p>
                    {deployWalletError && <Alert type="error" message={deployWalletError} onClose={() => setDeployWalletError(null)} />}
                    <Button onClick={handleCreateWallet} className="w-full mt-4">
                       Create My Smart Wallet (Gasless)
                    </Button>
                </div>
            )}
        </Card>
    );

    const renderPage = () => {
        switch (currentPage) {
            case 'minter':
                return (
                    <MintingInterface 
                        account={account} 
                        smartWalletAddress={smartWalletAddress}
                        saleState={saleState} 
                        onMintSuccess={fetchContractData} 
                        mintPrice={mintPrice} 
                    />
                );
            case 'wallet':
                if (!account) {
                    return <Card><p className="text-center text-yellow-400">Please connect your wallet to view this page.</p></Card>;
                }

                if (smartWalletAddress) {
                    return <WalletView account={account} smartWalletAddress={smartWalletAddress} />;
                }
                
                return (
                    <div className="space-y-8">
                        {renderWalletCreationCTA()}
                        <WalletView account={account} smartWalletAddress={null} />
                    </div>
                );
            default:
                return null;
        }
    };
    
    const MainContent = () => {
        if (isInitializing) return <div className="flex justify-center mt-12"><Spinner /></div>;
        if (networkError) return <Alert type="error" message={networkError} />;
        if (appError) return <Alert type="error" message={appError} />;

        if (currentPage === 'minter') {
            return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 mt-8">
                    <div className="flex flex-col gap-6">
                        <NFTDisplay
                            isLoading={false}
                            saleState={saleState}
                            mintedCount={mintedCount}
                            maxSupply={maxSupply}
                            mintPrice={mintPrice}
                            nftPreviewData={nftPreviewData}
                            onRefresh={fetchContractData}
                        />
                    </div>
                    <div className="w-full">
                        {renderPage()}
                    </div>
                </div>
            );
        }

        // For wallet page, use a single-column layout
        return (
            <div className="mt-8">
                {renderPage()}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6 md:p-8">
            <div className="max-w-7xl mx-auto">
                <Header 
                    account={account} 
                    connectWallet={connectWallet}
                    disconnectWallet={disconnectWallet}
                    currentPage={currentPage}
                    setCurrentPage={setCurrentPage}
                />
                <MainContent />
            </div>
        </div>
    );
};

export default App;