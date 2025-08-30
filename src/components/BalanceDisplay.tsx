import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { getReadOnlyProvider } from '../services/ethersService';
import Spinner from './shared/Spinner';

interface BalanceDisplayProps {
    address: string;
    title: string;
}

const BalanceDisplay: React.FC<BalanceDisplayProps> = ({ address, title }) => {
    const [balance, setBalance] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchBalance = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const provider = getReadOnlyProvider();
            const balanceWei = await provider.getBalance(address);
            const balanceEth = ethers.formatEther(balanceWei);
            // Format to a reasonable number of decimal places for display
            setBalance(parseFloat(balanceEth).toFixed(5));
        } catch (err) {
            console.error(`Failed to fetch balance for ${address}:`, err);
            setError("Could not load balance.");
        } finally {
            setIsLoading(false);
        }
    }, [address]);

    useEffect(() => {
        if (address) {
            fetchBalance();
        }
    }, [address, fetchBalance]);

    return (
        <div>
            <p className="text-sm text-gray-400">{title}</p>
            {isLoading ? (
                <div className="h-6 mt-1 flex items-center">
                    <Spinner />
                </div>
            ) : error ? (
                <p className="text-sm font-mono text-red-400 mt-1">{error}</p>
            ) : (
                <p className="text-lg font-mono text-cyan-400 mt-1">{balance} ETH</p>
            )}
        </div>
    );
};

export default BalanceDisplay;