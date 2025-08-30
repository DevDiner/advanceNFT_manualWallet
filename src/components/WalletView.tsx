import React, { useState, useEffect, useCallback } from 'react';
import { WalletViewProps, Erc20Token, Nft } from '../types';
import Card from './shared/Card';
import NFTGallery from './NFTGallery';
import RelayerDemo from './RelayerDemo';
import BalanceDisplay from './BalanceDisplay';
import { fetchErc20Balances, fetchErc721Nfts, fetchErc1155Nfts, getNftsForOwner } from '../services/ethersService';
import config from '../config';
import Spinner from './shared/Spinner';
import Alert from './shared/Alert';

type PortfolioTab = 'tokens' | 'nfts';
type ActiveWallet = 'eoa' | 'smart';

const WalletView: React.FC<WalletViewProps> = ({ account, smartWalletAddress }) => {
    const [activeTab, setActiveTab] = useState<PortfolioTab>('nfts');
    const [activeWallet, setActiveWallet] = useState<ActiveWallet>('eoa');
    
    const [erc20Tokens, setErc20Tokens] = useState<Erc20Token[]>([]);
    const [nfts, setNfts] = useState<Nft[]>([]);
    const [isLoading, setIsLoading] = useState({ tokens: true, nfts: true });
    const [error, setError] = useState<string | null>(null);
    
    // Intelligently default to the smart wallet view if it exists.
    useEffect(() => {
        if (smartWalletAddress) {
            setActiveWallet('smart');
        } else {
            setActiveWallet('eoa');
        }
    }, [smartWalletAddress]);

    // The address currently being displayed in the portfolio.
    const displayAddress = activeWallet === 'smart' && smartWalletAddress ? smartWalletAddress : account;

    const fetchPortfolio = useCallback(async () => {
        if (!displayAddress) return;
        setIsLoading({ tokens: true, nfts: true });
        setNfts([]);
        setErc20Tokens([]);
        setError(null);

        // A network-aware fetching strategy is more robust than relying on try/catch for flow control.
        if (config.isLocalhost) {
            // LOCALHOST: Use the on-chain brute-force method for this project's NFTs.
            // Full portfolio discovery is not possible without an indexer like Etherscan.
            setIsLoading({ tokens: false, nfts: true }); // No ERC20 discovery on localnet.
            try {
                const localNfts = await getNftsForOwner(displayAddress);
                setNfts(localNfts);
            } catch (e: any) {
                console.error("Failed to load local NFT portfolio:", e.message);
                setError(e.message || "Could not load NFT data on local network.");
            } finally {
                setIsLoading({ tokens: false, nfts: false });
            }
            return;
        }
        
        // LIVE NETWORKS (Sepolia, etc.): Use the Etherscan API for full discovery.
        
        // Fetch ERC20s in parallel.
        fetchErc20Balances(displayAddress)
            .then(setErc20Tokens)
            .catch(err => {
                console.error("Failed to load ERC20 tokens:", err);
                // Non-critical, so we don't set a main error, but we could show a partial error message.
            })
            .finally(() => setIsLoading(prev => ({ ...prev, tokens: false })));

        // Fetch NFTs progressively.
        try {
            const nfts721 = await fetchErc721Nfts(displayAddress);
            setNfts(nfts721);

            const nfts1155 = await fetchErc1155Nfts(displayAddress);
            // Combine without causing a race condition on state.
            setNfts(prevNfts => [...prevNfts, ...nfts1155]);
        } catch (e: any) {
            console.error("Failed to load NFT portfolio from Etherscan API:", e.message);
            setError(e.message || "An unknown error occurred while fetching NFT portfolio.");
        } finally {
            setIsLoading(prev => ({ ...prev, nfts: false }));
        }
    }, [displayAddress]);


    useEffect(() => {
        if (displayAddress) {
            fetchPortfolio();
        }
    }, [displayAddress, fetchPortfolio]);

    const TabButton: React.FC<{ tab: PortfolioTab, children: React.ReactNode }> = ({ tab, children }) => (
        <button
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === tab 
                ? 'border-b-2 border-purple-500 text-white' 
                : 'text-gray-400 hover:text-white'
            }`}
        >
            {children}
        </button>
    );
    
     const WalletToggleButton: React.FC<{ type: ActiveWallet, children: React.ReactNode }> = ({ type, children }) => (
        <button
            onClick={() => setActiveWallet(type)}
            className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all duration-200 ${
                activeWallet === type 
                ? 'bg-purple-600 text-white shadow-md' 
                : 'text-gray-300 hover:bg-gray-700'
            }`}
        >
            {children}
        </button>
    );

    return (
        <div className="space-y-8">
            <Card>
                {smartWalletAddress && (
                    <div className="flex justify-center mb-6 border-b border-gray-700 pb-4">
                        <div className="bg-gray-900 p-1 rounded-lg flex space-x-1">
                            <WalletToggleButton type="smart">Smart Wallet</WalletToggleButton>
                            <WalletToggleButton type="eoa">Connected Wallet (EOA)</WalletToggleButton>
                        </div>
                    </div>
                )}
            
                <h2 className="text-2xl font-bold text-white mb-6">
                    {activeWallet === 'smart' ? 'My Smart Wallet' : 'My Connected Wallet (EOA)'}
                </h2>
                <div className="space-y-4">
                     <div>
                        <p className="text-sm text-gray-400">{activeWallet === 'smart' ? 'Smart Wallet Address' : 'Wallet Address'}</p>
                        <p className="text-sm font-mono truncate text-purple-400">{displayAddress}</p>
                    </div>
                     {activeWallet === 'smart' && smartWalletAddress && (
                        <div>
                            <p className="text-sm text-gray-400">EOA Owner</p>
                            <p className="text-sm font-mono truncate mb-2">{account}</p>
                        </div>
                    )}
                </div>
            </Card>

            {config.isLocalhost && (
                <Card className="border-blue-700 bg-blue-900/30">
                    <p className="text-sm text-center text-blue-300">
                        You are on a local network. Full portfolio discovery (all ERC20s and NFTs from other collections) is only available on public networks like Sepolia.
                    </p>
                </Card>
            )}

            <Card>
                <div className="border-b border-gray-700">
                    <nav className="-mb-px flex space-x-4" aria-label="Tabs">
                        <TabButton tab="tokens">Tokens</TabButton>
                        <TabButton tab="nfts">NFTs</TabButton>
                    </nav>
                </div>

                <div className="mt-6">
                    {activeTab === 'tokens' ? (
                        <div className="space-y-4">
                           <BalanceDisplay address={displayAddress} title="Native Balance" />
                           {isLoading.tokens ? (
                               <div className="flex justify-center p-8"><Spinner /></div>
                           ) : (
                               <>
                                   {erc20Tokens.map(token => (
                                       <div key={token.contractAddress} className="border-t border-gray-700 pt-4">
                                           <p className="text-sm text-gray-400">{token.name}</p>
                                           <p className="text-lg font-mono text-cyan-400 mt-1">{parseFloat(token.balance).toFixed(4)} {token.symbol}</p>
                                       </div>
                                   ))}
                                   {erc20Tokens.length === 0 && !config.isLocalhost && <p className="text-center text-sm text-gray-500 pt-4">No ERC20 tokens found.</p>}
                               </>
                           )}
                        </div>
                    ) : (
                        <>
                            {(isLoading.nfts && nfts.length === 0 && !error) ? (
                                <div className="flex justify-center p-8"><Spinner /></div>
                            ) : error ? (
                                <Alert type="error" message={error} />
                            ) : (
                                <NFTGallery nfts={nfts} />
                            )}
                        </>
                    )}
                </div>
            </Card>
            
            {smartWalletAddress && <RelayerDemo account={account} smartWalletAddress={smartWalletAddress} />}
        </div>
    );
};
export default WalletView;