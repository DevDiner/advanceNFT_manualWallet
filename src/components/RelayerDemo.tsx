import React, { useState } from 'react';
import { ethers } from 'ethers';
import axios from 'axios';
import Card from './shared/Card';
import Button from './shared/Button';
import Spinner from './shared/Spinner';
import { SIMPLE_WALLET_ABI } from '../constants';
import config from '../config';
import { RelayerDemoProps } from '../types';
import Alert from './shared/Alert';


const RelayerDemo: React.FC<RelayerDemoProps> = ({ account, smartWalletAddress }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [txHash, setTxHash] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleMetaTx = async () => {
        setIsLoading(true);
        setSuccessMessage(null);
        setTxHash(null);
        setError(null);
        
        try {
            if(!window.ethereum) throw new Error("Wallet not found");
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const walletContract = new ethers.Contract(smartWalletAddress, SIMPLE_WALLET_ABI, provider);

            const valueToSend = ethers.parseEther("0"); 
            const data = "0x"; 
            const nonce = await walletContract.nonces(account);

            const domain = { name: 'SimpleWallet', version: '1', chainId: config.chainId, verifyingContract: smartWalletAddress };
            const types = { MetaTransaction: [ { name: 'from', type: 'address' }, { name: 'nonce', type: 'uint256' }, { name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'data', type: 'bytes' } ] };
            const message = { from: account, nonce: nonce, to: account, value: valueToSend, data: data };

            const signature = await signer.signTypedData(domain, types, message);
            
            // FIX: Convert all BigInt values to strings for JSON serialization.
            // This prevents a TypeError and ensures the backend receives the correct data.
            const payload = {
                 ...message,
                 nonce: message.nonce.toString(),
                 value: message.value.toString(),
                 signature,
                 smartWalletAddress,
            };

            const response = await axios.post('/api/relay', payload);
            
            setSuccessMessage(`Transaction relayed successfully! This was a gasless transaction sponsored by the relayer.`);
            setTxHash(response.data.txHash);

        } catch (err: any) {
            const errorMessage = err.response?.data?.error || err.message || "An unknown error occurred.";
            setError(`Failed to send meta-transaction: ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card>
            <h2 className="text-2xl font-bold text-white mb-2">Meta-Transaction Demo</h2>
            <p className="text-sm text-gray-400 mb-4">
                This demonstrates a "gasless" transaction using your smart wallet. When you click, you will sign a message (free). The relayer will then pay the gas to execute a simple transaction from your smart wallet back to yourself.
            </p>
            <Button onClick={handleMetaTx} disabled={isLoading}>
                {isLoading ? <Spinner /> : 'Execute Gasless Transaction'}
            </Button>
            <div className="mt-4">
                {successMessage && <Alert type="success" message={successMessage} txHash={txHash!} />}
                {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
            </div>
        </Card>
    );
};
export default RelayerDemo;
