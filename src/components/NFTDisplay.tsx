import React, { useState } from 'react';
import { NFTDisplayProps, SaleState } from '../types';
import Spinner from './shared/Spinner';
import Card from './shared/Card';
import config from '../config';

const NFTDisplay: React.FC<NFTDisplayProps> = ({ mintedCount, maxSupply, saleState, isLoading, mintPrice, nftPreviewData, onRefresh }) => {
    
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            await onRefresh();
        } finally {
            setTimeout(() => setIsRefreshing(false), 500); // Keep spinner for 500ms for better UX
        }
    };

    const getSaleStateText = (state: SaleState): { text: string; color: string } => {
        switch (state) {
            case SaleState.Closed: return { text: "Closed", color: "text-gray-400" };
            case SaleState.Airdrop: return { text: "Airdrop Active", color: "text-yellow-400" };
            case SaleState.PublicSale: return { text: "Public Sale Active", color: "text-green-400" };
            case SaleState.SoldOut: return { text: "Sold Out", color: "text-red-400" };
            default: return { text: "Unknown", color: "text-gray-500" };
        }
    };

    const saleStatus = getSaleStateText(saleState);

    const rarityColorMap: { [key: string]: string } = {
        'Common': 'text-gray-300',
        'Uncommon': 'text-green-400',
        'Rare': 'text-blue-400',
        'Legendary': 'text-yellow-400 animate-pulse'
    };

    const DetailRow: React.FC<{ label: string; value: string; href?: string; isMono?: boolean; valueColor?: string }> = 
    ({ label, value, href, isMono = true, valueColor = 'text-white' }) => (
        <div className="flex justify-between items-center text-sm">
            <span className="text-gray-400">{label}</span>
            {href ? (
                <a href={href} target="_blank" rel="noopener noreferrer" className={`font-mono text-purple-400 hover:underline`}>
                    {`${value.substring(0, 6)}...${value.substring(value.length - 4)}`}
                </a>
            ) : (
                <span className={`${isMono ? 'font-mono' : ''} ${valueColor}`}>{value}</span>
            )}
        </div>
    );

    if (isLoading) {
        return (
            <Card>
                <div className="flex justify-center items-center h-24">
                    <Spinner />
                </div>
            </Card>
        );
    }
    
    return (
        <>
            <Card>
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <span className="text-gray-400">Status</span>
                        <button onClick={handleRefresh} className="p-1.5 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500" aria-label="Refresh Status">
                           <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}>
                             <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001a10.5 10.5 0 01-10.5 10.5c-5.798 0-10.5-4.702-10.5-10.5s4.702-10.5 10.5-10.5V6.75a8.25 8.25 0 00-8.25 8.25c0 4.556 3.694 8.25 8.25 8.25s8.25-3.694 8.25-8.25V9.348z" />
                           </svg>
                        </button>
                    </div>
                    <span className={`font-bold text-lg ${saleStatus.color}`}>{saleStatus.text}</span>
                </div>
                {saleState === SaleState.PublicSale && (
                     <div className="flex justify-between items-center">
                        <span className="text-gray-400">Price</span>
                        <span className={`font-bold text-lg font-mono`}>{mintPrice} ETH</span>
                    </div>
                )}
                 <div className="border-t border-gray-700 my-2"></div>
                <div className="w-full bg-gray-700 rounded-full h-2.5">
                    <div className="bg-purple-600 h-2.5 rounded-full" style={{ width: `${maxSupply > 0 ? (mintedCount / maxSupply) * 100 : 0}%` }}></div>
                </div>
                <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Minted</span>
                    <span className="font-mono">{mintedCount} / {maxSupply}</span>
                </div>
            </Card>

            {/* UPDATE: The component now renders a professional, rich metadata preview card. */}
            {nftPreviewData && (
                 <Card>
                    <div className="aspect-square bg-gray-900 rounded-lg overflow-hidden mb-4">
                        <img src={nftPreviewData.image} alt={nftPreviewData.name} className="w-full h-full object-cover" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">{nftPreviewData.name}</h2>
                    <p className="text-sm text-gray-400 mt-1 mb-4">{nftPreviewData.description}</p>
                    
                    <div className="space-y-3 border-t border-gray-700 pt-4">
                        <DetailRow 
                            label="Contract address" 
                            value={nftPreviewData.contractAddress}
                            href={config.etherscanUrl ? `${config.etherscanUrl}/address/${nftPreviewData.contractAddress}` : undefined}
                        />
                        <DetailRow label="Token ID" value={nftPreviewData.tokenId} />
                        <DetailRow label="Token standard" value="ERC721" />
                         <DetailRow 
                            label="Rarity" 
                            value={nftPreviewData.rarity}
                            isMono={false}
                            valueColor={`font-bold ${rarityColorMap[nftPreviewData.rarity] || 'text-white'}`}
                        />
                    </div>
                </Card>
            )}
        </>
    );
};

export default NFTDisplay;