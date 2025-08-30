import React, { useState, useEffect, useCallback } from 'react';
import { Nft, NftMetadata } from '../types';
import { fetchNftMetadata } from '../services/ethersService';
import Spinner from './shared/Spinner';
import Alert from './shared/Alert';
import config from '../config';

interface NFTModalProps {
    nft: Nft;
    onClose: () => void;
}

const NFTModal: React.FC<NFTModalProps> = ({ nft, onClose }) => {
    const [metadata, setMetadata] = useState<NftMetadata | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isShowing, setIsShowing] = useState(false);

    const loadMetadata = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await fetchNftMetadata(nft.contractAddress, nft.tokenId, nft.balance);
            if (data) setMetadata(data);
            else throw new Error("Metadata could not be loaded.");
        } catch (e: any) {
            setError(e.message || "Failed to fetch NFT details.");
        } finally {
            setIsLoading(false);
        }
    }, [nft.contractAddress, nft.tokenId, nft.balance]);

    useEffect(() => {
        loadMetadata();
        // Trigger fade-in animation shortly after mounting
        const timer = setTimeout(() => setIsShowing(true), 50);
        return () => clearTimeout(timer);
    }, [loadMetadata]);

    const handleClose = useCallback(() => {
        setIsShowing(false);
        // Wait for animation to finish before calling parent's onClose
        setTimeout(onClose, 300);
    }, [onClose]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') handleClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleClose]);

    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) handleClose();
    };
    
    const DetailRow: React.FC<{ label: string; value: string | number; href?: string; }> = 
    ({ label, value, href }) => (
        <div className="flex justify-between items-center text-sm py-2 border-b border-gray-700/50">
            <span className="text-gray-400">{label}</span>
            {href ? (
                <a href={href} target="_blank" rel="noopener noreferrer" className={`font-mono text-purple-400 hover:underline truncate`}>
                    {value}
                </a>
            ) : (
                <span className={`font-mono text-white`}>{value}</span>
            )}
        </div>
    );
    
    const content = () => {
        if (isLoading) return <div className="p-12 flex justify-center items-center w-full"><Spinner /></div>;
        if (error) return <div className="p-8 w-full"><Alert type="error" message={error} /></div>;
        if (metadata) {
            return (
                <>
                    {/* --- Image Column --- */}
                    <div className="w-full md:w-1/2 aspect-square bg-gray-900 flex-shrink-0 md:rounded-l-2xl">
                        <img src={metadata.image || nft.imageUri || ''} alt={metadata.name} className="w-full h-full object-contain" />
                    </div>

                    {/* --- Metadata Column --- */}
                    <div className="w-full md:w-1/2 p-6 md:p-8 overflow-y-auto">
                        <div className="flex justify-between items-start mb-2">
                             <h2 className="text-3xl font-bold text-white pr-8">{metadata.name}</h2>
                             <button onClick={handleClose} className="p-1 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white transition-colors" aria-label="Close">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                             </button>
                        </div>
                        <p className="text-gray-400 mb-6">{metadata.description}</p>
                        
                        <div className="space-y-1 mb-6">
                            <DetailRow label="Contract" value={`${nft.contractAddress.substring(0, 6)}...${nft.contractAddress.substring(nft.contractAddress.length - 4)}`} href={config.etherscanUrl ? `${config.etherscanUrl}/address/${nft.contractAddress}` : undefined} />
                            <DetailRow label="Token ID" value={nft.tokenId} href={config.etherscanUrl ? `${config.etherscanUrl}/token/${nft.contractAddress}?id=${nft.tokenId}` : undefined} />
                            <DetailRow label="Token Standard" value={metadata.tokenStandard} />
                            {metadata.tokenStandard === 'ERC1155' && metadata.balance && (
                                <DetailRow label="Quantity" value={metadata.balance} />
                            )}
                        </div>
                        
                        {metadata.attributes && metadata.attributes.length > 0 && (
                            <div>
                                 <h3 className="text-lg font-semibold text-white mb-3 text-center">Attributes</h3>
                                 <div className="flex flex-wrap gap-2">
                                     {metadata.attributes.map(attr => (
                                         <div key={attr.trait_type} className="bg-purple-900/50 border border-purple-700 rounded-lg p-2 text-center flex-grow">
                                             <p className="text-xs text-purple-400 uppercase tracking-wider">{attr.trait_type}</p>
                                             <p className="font-semibold text-sm mt-1">{attr.value}</p>
                                         </div>
                                     ))}
                                 </div>
                            </div>
                        )}
                    </div>
                </>
            );
        }
        return null;
    }

    return (
        <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity duration-300"
            style={{ opacity: isShowing ? 1 : 0 }}
            onClick={handleBackdropClick}
            role="dialog"
            aria-modal="true"
        >
            <div className={`
                bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-lg md:max-w-4xl 
                max-h-[90vh] overflow-hidden flex flex-col md:flex-row 
                transform transition-all duration-300 ease-out 
                ${isShowing ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}
            `}>
                {content()}
            </div>
        </div>
    );
};

export default NFTModal;