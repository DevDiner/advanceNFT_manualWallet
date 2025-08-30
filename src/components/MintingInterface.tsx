import React from 'react';
// Fix: Use relative path and import MintingInterfaceProps
import { SaleState, MintingInterfaceProps } from '../types';
// Fix: Use relative paths for imports
import CommitRevealForm from './CommitRevealForm';
import Card from './shared/Card';

const MintingInterface: React.FC<MintingInterfaceProps> = (props) => {
    const { account, saleState } = props;

    const renderMainContent = () => {
        if (!account) {
            return (
                <div className="text-center text-yellow-400">
                    Please connect your wallet to mint.
                </div>
            );
        }

        if (saleState === SaleState.Closed) {
            return <p className="text-center text-gray-400">The sale is currently closed.</p>;
        }
        if (saleState === SaleState.SoldOut) {
            return <p className="text-center text-green-400 font-bold">All NFTs have been minted!</p>;
        }

        if (saleState === SaleState.Airdrop || saleState === SaleState.PublicSale) {
            return <CommitRevealForm {...props} isAirdrop={saleState === SaleState.Airdrop} />;
        }
        
        return <p className="text-center text-gray-400">Loading sale status...</p>;
    };

    return (
        <Card>
            <h2 className="text-2xl font-bold text-center mb-6">
                {saleState === SaleState.Airdrop ? 'Airdrop Claim' : 'Public Mint'}
            </h2>
            {renderMainContent()}
        </Card>
    );
};

export default MintingInterface;