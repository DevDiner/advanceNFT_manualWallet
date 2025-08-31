
import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { getContractWithSigner, getContract, getProvider, getReadOnlyProvider } from '../services/ethersService';
import Button from './shared/Button';
import Input from './shared/Input';
import Spinner from './shared/Spinner';
import config from '../config';
import { SIMPLE_WALLET_ABI } from '../constants';
import axios from 'axios';
import { MintingInterfaceProps } from '../types';
import Alert from './shared/Alert';

interface MerkleProofData {
    root: string;
    claims: { [address: string]: { index: number; proof: string[] } };
}

type MintingStatus = 'idle' | 'loading' | 'committing' | 'revealing' | 'cancelling' | 'committed' | 'stuck' | 'success' | 'error';

interface MintingState {
    status: MintingStatus;
    message: string | null;
    txHash: string | null;
}

interface CommitDetails {
    committer: string;
    hash: string;
    blockNumber: number;
    earliestRevealBlock: number;
    expiryBlock: number;
    expired: boolean;
    isAirdrop: boolean;
}

// A robust, recursive error parser to find the human-readable revert reason
// inside nested error objects from ethers.js or the relayer.
const findRevertReason = (err: any): string | null => {
    if (typeof err === 'string') {
        // Handle plain string errors, often found in `err.data.message`
        if (err.includes('reverted with reason string')) {
            const match = err.match(/'([^']*)'/);
            return match ? match[1] : err;
        }
        return err;
    }
    if (typeof err !== 'object' || err === null) return null;

    // Direct revert reason from ethers v6
    if (err.reason) return err.reason;

    // Recursively search nested properties where errors are often buried
    if (err.error) return findRevertReason(err.error);
    if (err.data) return findRevertReason(err.data);
    if (err.response?.data) return findRevertReason(err.response.data);

    // Final fallback to the message property
    if (err.message) return err.message;

    return null;
};

// FIX: Define CommitRevealFormProps by extending MintingInterfaceProps to resolve missing type error.
interface CommitRevealFormProps extends MintingInterfaceProps {
    isAirdrop: boolean;
}

const CommitRevealForm: React.FC<CommitRevealFormProps> = ({ account, smartWalletAddress, onMintSuccess, isAirdrop, mintPrice }) => {
    const [mintingState, setMintingState] = useState<MintingState>({ status: 'idle', message: null, txHash: null });
    const [secret, setSecret] = useState<string>('');
    const [estimatedGas, setEstimatedGas] = useState<string | null>(null);
    const [commitDetails, setCommitDetails] = useState<CommitDetails | null>(null);
    const [currentBlock, setCurrentBlock] = useState<number>(0);
    const [merkleProof, setMerkleProof] = useState<string[] | null>(null);
    const [merkleIndex, setMerkleIndex] = useState<number | null>(null);
    const [isWhitelisted, setIsWhitelisted] = useState<boolean>(!isAirdrop);
    const [smartWalletBalance, setSmartWalletBalance] = useState<bigint | null>(null);
    const [typedMerkleData, setTypedMerkleData] = useState<MerkleProofData | null>(null);
    const [isMerkleDataLoading, setIsMerkleDataLoading] = useState(isAirdrop);

    const storageKey = `commitData-${config.contractAddress}-${account}`;

    const resetState = useCallback(() => {
        setMintingState({ status: 'idle', message: null, txHash: null });
        setSecret('');
        setCommitDetails(null);
        localStorage.removeItem(storageKey);
    }, [storageKey]);

    const fetchSmartWalletBalance = useCallback(async () => {
        if (!smartWalletAddress) {
            setSmartWalletBalance(null);
            return;
        }
        try {
            const provider = getReadOnlyProvider();
            const balance = await provider.getBalance(smartWalletAddress);
            setSmartWalletBalance(balance);
        } catch (err) {
            console.error("Failed to fetch smart wallet balance:", err);
            setSmartWalletBalance(null);
        }
    }, [smartWalletAddress]);

    useEffect(() => {
        fetchSmartWalletBalance();
    }, [fetchSmartWalletBalance]);
    
    const handleError = useCallback((err: any, defaultMessage: string) => {
        const reason = findRevertReason(err);
        let displayError = reason || defaultMessage;
        
        // Clean up common boilerplate prefixes for a cleaner UI message.
        displayError = displayError
            .replace('execution reverted: ', '')
            .replace("Error: VM Exception while processing transaction: reverted with reason string '", '')
            .replace("Meta-transaction call failed'", "Meta-transaction call failed")
            .replace(/Error:.* reverted with reason string '/, '')
            .replace(/'$/, '');


        setMintingState({ status: 'error', message: displayError, txHash: null });
    }, []);

    useEffect(() => {
        if (!isAirdrop) return;

        let isMounted = true;
        const fetchMerkleData = async () => {
            setIsMerkleDataLoading(true);
            try {
                const response = await fetch('/merkle-proofs.json', { cache: 'no-store' });
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();
                if (isMounted) {
                    setTypedMerkleData(data);
                }
            } catch (error: any) {
                console.error("Failed to load merkle-proofs.json:", error);
                if (isMounted) {
                    setTypedMerkleData(null);
                    handleError(error, "Could not load the whitelist. Please try refreshing the page.");
                }
            } finally {
                if (isMounted) {
                    setIsMerkleDataLoading(false);
                }
            }
        };

        fetchMerkleData();
        return () => { isMounted = false; };
    }, [isAirdrop, handleError]);


    const checkCommitStatus = useCallback(async () => {
        if (!account) return;
        setMintingState({ status: 'loading', message: 'Checking your minting status...', txHash: null });
        try {
            const contract = getContract();
            const provider = getProvider();
            const latestBlock = await provider.getBlockNumber();
            setCurrentBlock(latestBlock);

            type CombinedCommit = ethers.Result & { committer: string; isAirdrop: boolean };
            let foundCommit: CombinedCommit | null = null;

            const publicCommit = await contract.getPublicCommit(account);
            if (publicCommit[0] !== ethers.ZeroHash) {
                foundCommit = { ...publicCommit, committer: account, isAirdrop: false };
            }
            if (!foundCommit && smartWalletAddress) {
                const swPublicCommit = await contract.getPublicCommit(smartWalletAddress);
                if (swPublicCommit[0] !== ethers.ZeroHash) {
                   foundCommit = { ...swPublicCommit, committer: smartWalletAddress, isAirdrop: false };
                }
            }
            if (!foundCommit) {
                const airdropCommit = await contract.getAirdropCommit(account);
                if (airdropCommit[0] !== ethers.ZeroHash) {
                     foundCommit = { ...airdropCommit, committer: account, isAirdrop: true };
                }
            }

            if (foundCommit) {
                setCommitDetails({
                    committer: foundCommit.committer, hash: foundCommit[0], blockNumber: Number(foundCommit[1]),
                    earliestRevealBlock: Number(foundCommit[2]), expiryBlock: Number(foundCommit[3]),
                    expired: foundCommit[4], isAirdrop: foundCommit.isAirdrop,
                });
                const storedData = localStorage.getItem(storageKey);
                if (storedData) {
                    setSecret(JSON.parse(storedData).secret);
                    setMintingState({ status: 'committed', message: null, txHash: null });
                } else {
                    setMintingState({ status: 'stuck', message: 'We found your commit on-chain, but the secret is missing from this browser. Please enter your saved secret to reveal, or cancel the transaction.', txHash: null });
                }
            } else {
                resetState();
            }
        } catch (err) {
            console.error("Failed to check commit status:", err);
            handleError(err, "Could not load your current minting status.");
        }
    }, [account, smartWalletAddress, resetState, storageKey, handleError]);

    useEffect(() => {
        checkCommitStatus();
        const interval = setInterval(() => setCurrentBlock(b => b + 1), 12000);
        return () => clearInterval(interval);
    }, [checkCommitStatus]);

    const estimateGas = useCallback(async () => {
        if (!isAirdrop && smartWalletAddress) {
            try {
                const contract = getContract();
                const provider = getProvider();
                const tempSecret = secret || ethers.hexlify(ethers.randomBytes(32));
                // FIX: Use the standard abi.encode hashing to match the simulation scripts.
                const commitHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(['bytes32'], [tempSecret]));

                const gasLimit = await contract.commitPublic.estimateGas(commitHash, { value: ethers.parseEther(mintPrice) });
                const feeData = await provider.getFeeData();
                const gasPrice = feeData.maxFeePerGas || feeData.gasPrice;
                if (gasPrice) {
                    const cost = gasLimit * gasPrice;
                    setEstimatedGas(`${ethers.formatEther(cost)} ETH`);
                }
            } catch (e) {
                console.error("Gas estimation failed:", e);
                setEstimatedGas(null);
            }
        }
    }, [isAirdrop, smartWalletAddress, mintPrice, secret]);

    useEffect(() => { estimateGas(); }, [estimateGas]);

    useEffect(() => {
        if (isAirdrop && account && typedMerkleData) {
            const claimsMap = typedMerkleData.claims;
            const lowercasedAccount = account.toLowerCase();
            
            const userAddressKey = Object.keys(claimsMap).find(addr => addr.toLowerCase() === lowercasedAccount);
            
            if (userAddressKey) {
                const claim = claimsMap[userAddressKey];
                setIsWhitelisted(true);
                setMerkleProof(claim.proof);
                setMerkleIndex(claim.index);
            } else {
                setIsWhitelisted(false);
            }
        } else {
            setIsWhitelisted(!isAirdrop);
        }
    }, [account, isAirdrop, typedMerkleData]);

    const generateSecret = () => setSecret(ethers.hexlify(ethers.randomBytes(32)));
    
    // "Self-healing" error handler for state-changing transactions.
    const handleTxError = useCallback((err: any, defaultMessage: string) => {
        // Step 1: Display the specific error message to the user immediately.
        handleError(err, defaultMessage);

        // Step 2: Automatically trigger a re-fetch to "heal" the UI.
        setTimeout(() => {
            console.log("Transaction failed due to possible state mismatch. Re-synchronizing with blockchain...");
            checkCommitStatus();
        }, 3000);
    }, [handleError, checkCommitStatus]);

    const handleCommit = async (viaSmartWallet: boolean) => {
        if (!secret || !account) return;
        setMintingState({ status: 'committing', message: 'Processing commit...', txHash: null });
        try {
            // FIX: Reverted to the correct commit hash scheme used by the smart contract.
            // All simulation scripts (airdrop, public sale, meta-tx) confirm that
            // the contract expects a simple keccak256 hash of the secret for all commits.
            const commitHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(['bytes32'], [secret]));
            
            let tx; let finalTxHash;
            if (viaSmartWallet && smartWalletAddress && !isAirdrop) {
                const nftInterface = new ethers.Interface(["function commitPublic(bytes32 commitHash)"]);
                const calldata = nftInterface.encodeFunctionData("commitPublic", [commitHash]);
                const provider = new ethers.BrowserProvider(window.ethereum!);
                const signer = await provider.getSigner();
                const walletContract = new ethers.Contract(smartWalletAddress, SIMPLE_WALLET_ABI, signer.provider);
                const nonce = await walletContract.nonces(account);
                const domain = { name: 'SimpleWallet', version: '1', chainId: config.chainId, verifyingContract: smartWalletAddress };
                const types = { MetaTransaction: [ { name: 'from', type: 'address' }, { name: 'nonce', type: 'uint256' }, { name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'data', type: 'bytes' } ] };
                const message = { from: account, nonce: nonce, to: config.contractAddress, value: ethers.parseEther(mintPrice), data: calldata };
                const signature = await signer.signTypedData(domain, types, message);
                const payload = { ...message, nonce: message.nonce.toString(), value: message.value.toString(), signature, smartWalletAddress };
                const response = await axios.post(`${config.relayerUrl}/relay`, payload);
                finalTxHash = response.data.txHash;
            } else {
                const contract = await getContractWithSigner();
                tx = isAirdrop ? await contract.commitAirdrop(commitHash) : await contract.commitPublic(commitHash, { value: ethers.parseEther(mintPrice) });
                finalTxHash = tx.hash;
                await tx.wait();
            }
            localStorage.setItem(storageKey, JSON.stringify({ secret }));
            setMintingState({ status: 'success', message: 'Commit successful! Waiting for block confirmation to update status.', txHash: finalTxHash });
            checkCommitStatus();
        } catch (err: any) {
            handleError(err, "Commit failed.");
        }
    };
    
    const handleReveal = async () => {
       if (!secret || !account || !commitDetails) return;
        setMintingState({ status: 'revealing', message: "Processing reveal...", txHash: null });
        try {
            let tx; let finalTxHash;
            const recipient = commitDetails.committer;
            if (recipient === smartWalletAddress) {
                const nftInterface = new ethers.Interface(["function mintFor(address recipient, bytes32 secret)"]);
                const calldata = nftInterface.encodeFunctionData("mintFor", [recipient, secret]);
                const provider = new ethers.BrowserProvider(window.ethereum!);
                const signer = await provider.getSigner();
                const walletContract = new ethers.Contract(smartWalletAddress, SIMPLE_WALLET_ABI, signer.provider);
                const nonce = await walletContract.nonces(account);
                const domain = { name: 'SimpleWallet', version: '1', chainId: config.chainId, verifyingContract: smartWalletAddress };
                const types = { MetaTransaction: [ { name: 'from', type: 'address' }, { name: 'nonce', type: 'uint256' }, { name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'data', type: 'bytes' } ] };
                const message = { from: account, nonce: nonce, to: config.contractAddress, value: 0, data: calldata };
                const signature = await signer.signTypedData(domain, types, message);
                const payload = { ...message, nonce: message.nonce.toString(), value: '0', signature, smartWalletAddress };
                const response = await axios.post(`${config.relayerUrl}/relay`, payload);
                finalTxHash = response.data.txHash;
            } else {
                const contract = await getContractWithSigner();
                tx = commitDetails.isAirdrop ? await contract.revealAirdrop(merkleIndex!, secret, merkleProof!) : await contract.mintFor(recipient, secret);
                finalTxHash = tx.hash;
                await tx.wait();
            }

            let successMsg = "Mint successful! Your NFT has been created.";
            if (recipient === smartWalletAddress) {
                successMsg = "Mint successful! This gasless transaction was sponsored by the relayer.";
            }
            setMintingState({ status: 'success', message: successMsg, txHash: finalTxHash });
            
            await onMintSuccess();
            setTimeout(resetState, 5000);
        } catch(err: any) {
            handleTxError(err, "Reveal failed.");
        }
    };
    
    const handleCancel = async () => {
        if (!account || !commitDetails) return;
        setMintingState({ status: 'cancelling', message: "Processing cancellation...", txHash: null });
        try {
            const contract = await getContractWithSigner();
            const tx = commitDetails.isAirdrop ? await contract.cancelAirdropCommit() : await contract.cancelPublicCommit();
            await tx.wait();
            setMintingState({ status: 'success', message: commitDetails.isAirdrop ? "Commit cancelled." : "Commit cancelled and funds refunded.", txHash: tx.hash });
            setTimeout(resetState, 5000);
        } catch (err: any) {
             handleTxError(err, "Cancellation failed.");
        }
    };
    
    const renderAlerts = () => {
        const { status, message, txHash } = mintingState;
        if (status === 'error') {
            return <Alert type="error" message={message!} onClose={() => setMintingState({ status: 'idle', message: null, txHash: null })} />;
        }
        if (status === 'success') {
            return <Alert type="success" message={message!} txHash={txHash!} />;
        }
        if (['loading', 'committing', 'revealing', 'cancelling'].includes(status) && status !== 'committed') {
            return <Alert type="info" message={message || "Loading..."} />;
        }
        return null;
    }

    if (isAirdrop && isMerkleDataLoading) {
        return <Alert type="info" message="Verifying whitelist status..." />;
    }

    if (!isWhitelisted) {
        return <Alert type="info" message="Your connected wallet is not on the airdrop whitelist." />;
    }

    const isLoading = ['loading', 'committing', 'revealing', 'cancelling'].includes(mintingState.status);
    
    const mintPriceWei = ethers.parseEther(mintPrice || '0');
    const isBalanceInsufficient = smartWalletBalance !== null && smartWalletBalance < mintPriceWei;

    if (commitDetails) {
        const isWaiting = currentBlock < commitDetails.earliestRevealBlock;
        const isExpired = currentBlock > commitDetails.expiryBlock;
        return (
            <div className="space-y-4 text-center">
                {renderAlerts()}
                {mintingState.status === 'stuck' && <Alert type="error" message={mintingState.message!} />}
                <h3 className="text-lg font-bold">Commit Found</h3>
                <p className="text-sm text-gray-400">An active commit from <span className="font-mono text-xs">{commitDetails.committer}</span> was found on-chain.</p>
                <Input label="Your Secret" value={secret} onChange={e => setSecret(e.target.value)} disabled={mintingState.status !== 'stuck'} placeholder="Enter your saved 32-byte secret" />

                {isExpired ? (
                    <div className="bg-red-900/50 p-4 rounded-lg"><p className="font-bold text-red-300">Commit Expired</p><p className="text-xs text-red-400 mt-1">{`The reveal window has closed. Your only option is to cancel${commitDetails.isAirdrop ? '.' : ' and get a refund.'}`}</p></div>
                ) : isWaiting ? (
                    <div className="bg-blue-900/50 p-4 rounded-lg"><p className="font-bold text-blue-300">Waiting for Reveal Window</p><p className="text-xs text-blue-400 mt-1">You can reveal at block <span className="font-mono">{commitDetails.earliestRevealBlock}</span> (Current: <span className="font-mono">{currentBlock}</span>)</p></div>
                ) : (
                    <div className="bg-green-900/50 p-4 rounded-lg"><p className="font-bold text-green-300">Ready to Reveal!</p><p className="text-xs text-green-400 mt-1">You must reveal before block <span className="font-mono">{commitDetails.expiryBlock}</span>.</p></div>
                )}
                
                <Button onClick={handleReveal} disabled={isWaiting || isExpired || isLoading || !secret}>
                    {mintingState.status === 'revealing' ? <Spinner /> : 'Reveal & Mint NFT'}
                </Button>
                 <Button onClick={handleCancel} disabled={isLoading} variant="secondary">
                     {mintingState.status === 'cancelling' ? <Spinner /> : (commitDetails.isAirdrop ? 'Cancel Commit' : 'Cancel & Refund')}
                </Button>
            </div>
        );
    }
    
    return (
        <div className="space-y-4">
            {renderAlerts()}
            <h3 className="text-lg font-semibold text-center">Step 1: Commit</h3>
            <Input label="Your Secure Secret" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="Click the button to generate a secret" disabled={isLoading} />
            <Button onClick={generateSecret} variant="secondary" className="w-full">Generate Secure Secret</Button>
            <div className="border-t border-gray-700 my-2"></div>
            <Button onClick={() => handleCommit(false)} disabled={!secret || isLoading} className="w-full">
                {mintingState.status === 'committing' ? <Spinner/> : (isAirdrop ? 'Commit to Claim Airdrop' : `Commit with MetaMask (${mintPrice} ETH)`) }
            </Button>
            {!isAirdrop && smartWalletAddress && (
                <div className="mt-4 text-center">
                     {isBalanceInsufficient && (
                        <Alert 
                            type="error" 
                            message={`Your smart wallet has insufficient funds. Please send at least ${mintPrice} ETH to your smart wallet address to proceed.`}
                        />
                    )}
                    <p className="text-xs text-gray-400 mb-2">Or use your smart wallet for a gas-free transaction:</p>
                    <Button onClick={() => handleCommit(true)} disabled={!secret || isLoading || isBalanceInsufficient} className="w-full" variant="secondary">
                        {mintingState.status === 'committing' ? <Spinner/> : 'Commit Gaslessly via Smart Wallet' }
                    </Button>
                    {estimatedGas && <p className="text-xs text-gray-500 mt-2">Relayer will cover the estimated gas fee of ~{estimatedGas}</p>}
                </div>
            )}
        </div>
    );
};

export default CommitRevealForm;
