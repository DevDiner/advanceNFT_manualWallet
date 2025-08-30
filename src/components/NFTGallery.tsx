import React, { useState, useEffect, useCallback } from 'react';
import { Nft } from '../types';
import NFTModal from './NFTModal';
import { fetchNftMetadata } from '../services/ethersService';
import Spinner from './shared/Spinner';
import Button from './shared/Button';

interface NFTGalleryProps {
    nfts: Nft[];
}

// Sub-component to handle individual NFT loading and display.
// This allows the gallery to show placeholders immediately and then
// load in the images for each NFT as the data arrives.
const NFTCard: React.FC<{ nft: Nft; onClick: (nft: Nft) => void }> = ({ nft: initialNft, onClick }) => {
    const [nft, setNft] = useState<Nft>(initialNft);
    const [isLoading, setIsLoading] = useState<boolean>(!initialNft.imageUri);

    useEffect(() => {
        let isMounted = true;
        // Only fetch if the image URI is missing, which indicates we haven't
        // fetched full metadata for this NFT yet.
        if (!initialNft.imageUri) {
            setIsLoading(true);
            fetchNftMetadata(initialNft.contractAddress, initialNft.tokenId)
                .then(metadata => {
                    if (isMounted && metadata) {
                        setNft(prevNft => ({
                            ...prevNft,
                            name: metadata.name || prevNft.name,
                            imageUri: metadata.image || null,
                        }));
                    }
                })
                .catch(error => console.error(`Failed to load metadata for NFT ${initialNft.tokenId}:`, error))
                .finally(() => {
                    if (isMounted) setIsLoading(false);
                });
        }
        return () => { isMounted = false; };
    }, [initialNft]); // Dependency ensures this runs if the initial prop changes.

    return (
        <button
            className="aspect-square bg-gray-900 rounded-lg overflow-hidden shadow-lg group relative focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-transform duration-300 hover:scale-105"
            onClick={() => onClick(nft)} // Pass the latest state of the NFT on click
            aria-label={`View details for ${nft.name}`}
        >
            {isLoading ? (
                <div className="w-full h-full flex items-center justify-center"><Spinner /></div>
            ) : nft.imageUri ? (
                <img src={nft.imageUri} alt={nft.name} className="w-full h-full object-cover" />
            ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-center p-2">
                    <p className="text-xs text-gray-400">{nft.name}</p>
                    <p className="text-xs text-gray-500 font-mono mt-1">ID: {nft.tokenId}</p>
                    <p className="text-xs text-gray-600 mt-2">No Image Found</p>
                </div>
            )}
            {nft.tokenStandard === 'ERC1155' && nft.balance && (
                <div className="absolute bottom-2 right-2 bg-gray-900/80 text-white text-xs font-bold px-2 py-1 rounded-md backdrop-blur-sm">
                    x{nft.balance}
                </div>
            )}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                <p className="text-white font-bold">Details</p>
            </div>
        </button>
    );
};


const NFTGallery: React.FC<NFTGalleryProps> = ({ nfts }) => {
    const [selectedNft, setSelectedNft] = useState<Nft | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const nftsPerPage = 8;

    // State for swipe gestures
    const [touchStartX, setTouchStartX] = useState<number | null>(null);
    const [touchEndX, setTouchEndX] = useState<number | null>(null);
    const minSwipeDistance = 50; 

    // Reset to page 1 if the NFT list changes to prevent being on an invalid page.
    useEffect(() => {
        setCurrentPage(1);
    }, [nfts]);

    const totalPages = Math.ceil(nfts.length / nftsPerPage);
    const indexOfLastNft = currentPage * nftsPerPage;
    const indexOfFirstNft = indexOfLastNft - nftsPerPage;
    const currentNfts = nfts.slice(indexOfFirstNft, indexOfLastNft);
    
    // --- Hybrid Navigation Handlers ---
    // Memoize handlers for stability in useEffect dependency arrays.
    const handleNextPage = useCallback(() => {
        if (currentPage < totalPages) {
            setCurrentPage(prev => prev + 1);
        }
    }, [currentPage, totalPages]);

    const handlePrevPage = useCallback(() => {
        if (currentPage > 1) {
            setCurrentPage(prev => prev - 1);
        }
    }, [currentPage]);
    
    // Keyboard navigation effect
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (selectedNft) return; // Don't navigate when modal is open
            if (event.key === 'ArrowRight') handleNextPage();
            if (event.key === 'ArrowLeft') handlePrevPage();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleNextPage, handlePrevPage, selectedNft]);

    // Touch gesture handlers for swipe navigation
    const handleTouchStart = (e: React.TouchEvent) => {
        setTouchEndX(null); // Reset on new touch
        setTouchStartX(e.targetTouches[0].clientX);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        setTouchEndX(e.targetTouches[0].clientX);
    };

    const handleTouchEnd = () => {
        if (!touchStartX || !touchEndX) return;
        const distance = touchStartX - touchEndX;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;

        if (isLeftSwipe) handleNextPage();
        else if (isRightSwipe) handlePrevPage();
        
        // Reset after swipe
        setTouchStartX(null);
        setTouchEndX(null);
    };


    return (
        <div>
            <h2 className="text-2xl font-bold text-white mb-4">NFT Collection</h2>
            {nfts.length === 0 ? (
                <p className="text-center text-gray-400">No NFTs found in this wallet.</p>
            ) : (
                <>
                    <div 
                        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4"
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                    >
                        {currentNfts.map((nft) => (
                            <NFTCard 
                                key={`${nft.contractAddress}-${nft.tokenId}`} 
                                nft={nft}
                                onClick={setSelectedNft}
                            />
                        ))}
                    </div>
                     {totalPages > 1 && (
                        <div className="flex justify-center items-center mt-8 gap-4">
                            <Button
                                onClick={handlePrevPage}
                                disabled={currentPage === 1}
                                variant="secondary"
                                className="px-4 py-2"
                                aria-label="Go to previous page"
                            >
                                Previous
                            </Button>
                            <span className="text-gray-400 text-sm font-mono" aria-live="polite">
                                Page {currentPage} of {totalPages}
                            </span>
                            <Button
                                onClick={handleNextPage}
                                disabled={currentPage === totalPages}
                                variant="secondary"
                                className="px-4 py-2"
                                aria-label="Go to next page"
                            >
                                Next
                            </Button>
                        </div>
                    )}
                </>
            )}
            {selectedNft && (
                <NFTModal nft={selectedNft} onClose={() => setSelectedNft(null)} />
            )}
        </div>
    );
};
export default NFTGallery;