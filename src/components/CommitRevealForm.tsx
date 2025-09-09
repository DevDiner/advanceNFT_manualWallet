// src/components/CommitRevealForm.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import axios from 'axios';

import {
  getContractWithSigner,
  getContract,
  getProvider,
  getReadOnlyProvider,
} from '../services/ethersService';

import Button from './shared/Button';
import Input from './shared/Input';
import Spinner from './shared/Spinner';
import Alert from './shared/Alert';

import config from '../config';
import { SIMPLE_WALLET_ABI } from '../constants';
import { MintingInterfaceProps } from '../types';

//  Merkle file shape (runtime-loaded) 
interface MerkleProofData {
  root: string;
  claims: { [address: string]: { index: number; proof: string[] } };
}

//  Local types 
type MintingStatus =
  | 'idle'
  | 'loading'
  | 'committing'
  | 'revealing'
  | 'cancelling'
  | 'committed'
  | 'stuck'
  | 'success'
  | 'error';

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

//  Revert reason extraction 
const findRevertReason = (err: any): string | null => {
  if (typeof err === 'string') {
    const m1 = err.match(/reverted with reason string '([^']+)'/);
    if (m1) return m1[1];
    const m2 = err.match(/execution reverted: ([^"]+)/i);
    if (m2) return m2[1];
    return err;
  }
  if (!err || typeof err !== 'object') return null;

  if (err.reason) return err.reason;
  return (
    findRevertReason(err.error) ||
    findRevertReason(err.data) ||
    findRevertReason(err.response?.data) ||
    err.message ||
    null
  );
};

// Extend your existing props
interface CommitRevealFormProps extends MintingInterfaceProps {
  isAirdrop: boolean;
}

/**
 * CommitRevealForm
 * - Handles both presale (airdrop) commit/reveal and paid public commit/reveal.
 * - Supports gasless meta-tx via SimpleWallet for public commit/reveal.
 * - Self-heals UI by re-checking on-chain state after failures/rejections.
 */
const CommitRevealForm: React.FC<CommitRevealFormProps> = ({
  account,
  smartWalletAddress,
  onMintSuccess,
  isAirdrop,
  mintPrice,
}) => {
  //  State 
  const [mintingState, setMintingState] = useState<MintingState>({
    status: 'idle',
    message: null,
    txHash: null,
  });
  const [secret, setSecret] = useState<string>('');
  const [estimatedGas, setEstimatedGas] = useState<string | null>(null);
  const [commitDetails, setCommitDetails] = useState<CommitDetails | null>(
    null
  );
  const [currentBlock, setCurrentBlock] = useState<number>(0);

  const [typedMerkleData, setTypedMerkleData] = useState<MerkleProofData | null>(
    null
  );
  const [isMerkleDataLoading, setIsMerkleDataLoading] =
    useState<boolean>(isAirdrop);
  const [isWhitelisted, setIsWhitelisted] = useState<boolean>(!isAirdrop);
  const [merkleProof, setMerkleProof] = useState<string[] | null>(null);
  const [merkleIndex, setMerkleIndex] = useState<number | null>(null);

  const [smartWalletBalance, setSmartWalletBalance] = useState<bigint | null>(
    null
  );

  const storageKey = `commitData-${config.contractAddress}-${account}`;

  //  Helpers 
  const handleError = useCallback((err: any, fallback: string) => {
    let msg = findRevertReason(err) || fallback;
    msg = msg
      .replace(/^execution reverted:\s*/i, '')
      .replace(/Error: VM Exception while processing transaction:\s*/i, '')
      .replace(/reverted with reason string\s*/i, '')
      .replace(/^'|'\s*$/g, '');
    setMintingState({ status: 'error', message: msg, txHash: null });
  }, []);

  const handleTxError = useCallback(
    (err: any, fallback: string) => {
      handleError(err, fallback);
      setTimeout(() => {
        // Self-heal the UI by re-syncing
        checkCommitStatus();
      }, 2000);
    },
    [handleError] // eslint-disable-line
  );

  const resetState = useCallback(() => {
    setMintingState({ status: 'idle', message: null, txHash: null });
    setSecret('');
    setCommitDetails(null);
    localStorage.removeItem(storageKey);
  }, [storageKey]);

  //  Balances 
  const fetchSmartWalletBalance = useCallback(async () => {
    if (!smartWalletAddress) {
      setSmartWalletBalance(null);
      return;
    }
    try {
      const provider = getReadOnlyProvider();
      const bal = await provider.getBalance(smartWalletAddress);
      setSmartWalletBalance(bal);
    } catch (e) {
      console.error('Failed to fetch smart wallet balance', e);
      setSmartWalletBalance(null);
    }
  }, [smartWalletAddress]);

  useEffect(() => {
    fetchSmartWalletBalance();
  }, [fetchSmartWalletBalance]);

  //  Merkle (airdrop) 
  useEffect(() => {
    if (!isAirdrop) return;

    let mounted = true;
    (async () => {
      setIsMerkleDataLoading(true);
      try {
        const res = await fetch('/merkle-proofs.json', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as MerkleProofData;
        if (mounted) setTypedMerkleData(data);
      } catch (e: any) {
        console.error('merkle-proofs.json load failed', e);
        if (mounted) {
          setTypedMerkleData(null);
          handleError(e, 'Could not load whitelist data. Try refreshing.');
        }
      } finally {
        if (mounted) setIsMerkleDataLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [isAirdrop, handleError]);

  useEffect(() => {
    if (isAirdrop && account && typedMerkleData) {
      const lower = account.toLowerCase();
      const entryKey = Object.keys(typedMerkleData.claims).find(
        (k) => k.toLowerCase() === lower
      );
      if (entryKey) {
        const { index, proof } = typedMerkleData.claims[entryKey];
        setIsWhitelisted(true);
        setMerkleIndex(index);
        setMerkleProof(proof);
      } else {
        setIsWhitelisted(false);
        setMerkleIndex(null);
        setMerkleProof(null);
      }
    } else {
      setIsWhitelisted(!isAirdrop);
    }
  }, [isAirdrop, account, typedMerkleData]);

  //  Status check 
  const checkCommitStatus = useCallback(async () => {
    if (!account) return;
    setMintingState({
      status: 'loading',
      message: 'Checking your minting status...',
      txHash: null,
    });

    try {
      const contract = getContract();
      const provider = getProvider();
      const latest = await provider.getBlockNumber();
      setCurrentBlock(latest);

      type CombinedCommit = ethers.Result & {
        committer: string;
        isAirdrop: boolean;
      };
      let found: CombinedCommit | null = null;

      // Look for public commit by EOA
      const pub = await contract.getPublicCommit(account);
      if (pub[0] !== ethers.ZeroHash) {
        found = { ...pub, committer: account, isAirdrop: false };
      }

      // Look for public commit by Smart Wallet (if any)
      if (!found && smartWalletAddress) {
        const sw = await contract.getPublicCommit(smartWalletAddress);
        if (sw[0] !== ethers.ZeroHash) {
          found = { ...sw, committer: smartWalletAddress, isAirdrop: false };
        }
      }

      // Look for airdrop commit by EOA
      if (!found) {
        const ad = await contract.getAirdropCommit(account);
        if (ad[0] !== ethers.ZeroHash) {
          found = { ...ad, committer: account, isAirdrop: true };
        }
      }

      if (found) {
        setCommitDetails({
          committer: found.committer,
          hash: found[0],
          blockNumber: Number(found[1]),
          earliestRevealBlock: Number(found[2]),
          expiryBlock: Number(found[3]),
          expired: Boolean(found[4]),
          isAirdrop: found.isAirdrop,
        });

        const saved = localStorage.getItem(storageKey);
        if (saved) {
          setSecret(JSON.parse(saved).secret);
          setMintingState({ status: 'committed', message: null, txHash: null });
        } else {
          setMintingState({
            status: 'stuck',
            message:
              'We found your commit on-chain, but the secret is missing from this browser. Please enter your saved secret to reveal, or cancel the transaction.',
            txHash: null,
          });
        }
      } else {
        resetState();
      }
    } catch (e) {
      console.error('checkCommitStatus failed', e);
      handleError(e, 'Could not load your current minting status.');
    }
  }, [account, smartWalletAddress, resetState, storageKey, handleError]);

  useEffect(() => {
    checkCommitStatus();
    // optimistic block ticker so the UI counts up between RPC polls
    const id = setInterval(() => setCurrentBlock((b) => b + 1), 12_000);
    return () => clearInterval(id);
  }, [checkCommitStatus]);

  //  Estimates 
  const estimateGas = useCallback(async () => {
    if (isAirdrop || !smartWalletAddress) {
      setEstimatedGas(null);
      return;
    }
    try {
      const contract = getContract();
      const provider = getProvider();

      const tmpSecret = secret || ethers.hexlify(ethers.randomBytes(32));
      const commitHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(['bytes32'], [tmpSecret])
      );

      const gasLimit = await contract.commitPublic.estimateGas(commitHash, {
        value: ethers.parseEther(mintPrice),
      });
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.maxFeePerGas || feeData.gasPrice;
      if (gasPrice) {
        const cost = gasLimit * gasPrice;
        setEstimatedGas(`${ethers.formatEther(cost)} ETH`);
      }
    } catch (e) {
      console.warn('Gas estimation failed', e);
      setEstimatedGas(null);
    }
  }, [isAirdrop, smartWalletAddress, mintPrice, secret]);

  useEffect(() => {
    estimateGas();
  }, [estimateGas]);

  //  Actions 
  const generateSecret = () =>
    setSecret(ethers.hexlify(ethers.randomBytes(32)));

  const handleCommit = async (viaSmartWallet: boolean) => {
    if (!secret || !account) return;

    setMintingState({
      status: 'committing',
      message: 'Processing commit...',
      txHash: null,
    });

    try {
      const commitHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(['bytes32'], [secret])
      );

      let finalHash: string;

      if (viaSmartWallet && smartWalletAddress && !isAirdrop) {
        // Encode NFT.commitPublic(commitHash)
        const nftIface = new ethers.Interface([
          'function commitPublic(bytes32 commitHash)',
        ]);
        const calldata = nftIface.encodeFunctionData('commitPublic', [
          commitHash,
        ]);

        // Browser signer (EOA) signs EIP-712 meta-tx for the SimpleWallet
        const browser = new ethers.BrowserProvider(window.ethereum!);
        const signer = await browser.getSigner();

        // Use the live chainId from provider (avoids mismatches)
        const { chainId } = await browser.getNetwork();

        const wallet = new ethers.Contract(
          smartWalletAddress,
          SIMPLE_WALLET_ABI,
          signer.provider
        );
        const nonce: bigint = await wallet.nonces(account);

        const domain = {
          name: 'SimpleWallet',
          version: '1',
          chainId, // bigint is fine in ethers v6
          verifyingContract: smartWalletAddress,
        };
        const types = {
          MetaTransaction: [
            { name: 'from', type: 'address' },
            { name: 'nonce', type: 'uint256' },
            { name: 'to', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'data', type: 'bytes' },
          ],
        };
        const message = {
          from: account,
          nonce,
          to: config.contractAddress,
          value: ethers.parseEther(mintPrice),
          data: calldata,
        };

        const signature = await signer.signTypedData(domain, types, message);
        const payload = {
          ...message,
          nonce: message.nonce.toString(),
          value: message.value.toString(),
          signature,
          smartWalletAddress,
        };

        const resp = await axios.post('/api/relay', payload);
        finalHash = resp.data.txHash;
      } else {
        // Direct commit via connected EOA
        const contract = await getContractWithSigner();
        const tx = isAirdrop
          ? await contract.commitAirdrop(commitHash)
          : await contract.commitPublic(commitHash, {
              value: ethers.parseEther(mintPrice),
            });
        finalHash = tx.hash;
        await tx.wait();
      }

      localStorage.setItem(storageKey, JSON.stringify({ secret }));
      setMintingState({
        status: 'success',
        message:
          'Commit successful! Waiting for block confirmation to update status.',
        txHash: finalHash,
      });
      checkCommitStatus();
    } catch (e: any) {
      handleTxError(e, 'Commit failed.');
    }
  };

  const handleReveal = async () => {
    if (!secret || !account || !commitDetails) return;

    setMintingState({
      status: 'revealing',
      message: 'Processing reveal...',
      txHash: null,
    });

    try {
      let finalHash: string;
      const recipient = commitDetails.committer;

      if (recipient === smartWalletAddress) {
        // Meta-tx: wallet.mintFor(recipient, secret)
        const nftIface = new ethers.Interface([
          'function mintFor(address recipient, bytes32 secret)',
        ]);
        const calldata = nftIface.encodeFunctionData('mintFor', [
          recipient,
          secret,
        ]);

        const browser = new ethers.BrowserProvider(window.ethereum!);
        const signer = await browser.getSigner();
        const { chainId } = await browser.getNetwork();

        const wallet = new ethers.Contract(
          smartWalletAddress!,
          SIMPLE_WALLET_ABI,
          signer.provider
        );
        const nonce: bigint = await wallet.nonces(account);

        const domain = {
          name: 'SimpleWallet',
          version: '1',
          chainId,
          verifyingContract: smartWalletAddress!,
        };
        const types = {
          MetaTransaction: [
            { name: 'from', type: 'address' },
            { name: 'nonce', type: 'uint256' },
            { name: 'to', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'data', type: 'bytes' },
          ],
        };
        const message = {
          from: account,
          nonce,
          to: config.contractAddress,
          value: 0,
          data: calldata,
        };

        const signature = await signer.signTypedData(domain, types, message);
        const payload = {
          ...message,
          nonce: message.nonce.toString(),
          value: '0',
          signature,
          smartWalletAddress,
        };
        const resp = await axios.post('/api/relay', payload);
        finalHash = resp.data.txHash;
      } else {
        // Direct reveal via connected EOA
        const contract = await getContractWithSigner();
        const tx = commitDetails.isAirdrop
          ? await contract.revealAirdrop(merkleIndex!, secret, merkleProof!)
          : await contract.mintFor(recipient, secret);
        finalHash = tx.hash;
        await tx.wait();
      }

      const successMsg =
        recipient === smartWalletAddress
          ? 'Mint successful! This gasless transaction was sponsored by the relayer.'
          : 'Mint successful! Your NFT has been created.';

      setMintingState({
        status: 'success',
        message: successMsg,
        txHash: finalHash,
      });

      await onMintSuccess();
      setTimeout(resetState, 5_000);
    } catch (e: any) {
      handleTxError(e, 'Reveal failed.');
    }
  };

  const handleCancel = async () => {
    if (!account || !commitDetails) return;

    setMintingState({
      status: 'cancelling',
      message: 'Processing cancellation...',
      txHash: null,
    });

    try {
      const contract = await getContractWithSigner();
      const tx = commitDetails.isAirdrop
        ? await contract.cancelAirdropCommit()
        : await contract.cancelPublicCommit();
      await tx.wait();

      setMintingState({
        status: 'success',
        message: commitDetails.isAirdrop
          ? 'Commit cancelled.'
          : 'Commit cancelled and funds refunded.',
        txHash: tx.hash,
      });
      setTimeout(resetState, 5_000);
    } catch (e: any) {
      handleTxError(e, 'Cancellation failed.');
    }
  };

  //  UI helpers 
  const renderAlerts = () => {
    const { status, message, txHash } = mintingState;
    if (status === 'error') {
      return (
        <Alert
          type="error"
          message={message!}
          onClose={() =>
            setMintingState({ status: 'idle', message: null, txHash: null })
          }
        />
      );
    }
    if (status === 'success') {
      return <Alert type="success" message={message!} txHash={txHash!} />;
    }
    if (
      ['loading', 'committing', 'revealing', 'cancelling'].includes(status) &&
      status !== 'committed'
    ) {
      return <Alert type="info" message={message || 'Loading...'} />;
    }
    return null;
  };

  //  Rendering 
  if (isAirdrop && isMerkleDataLoading) {
    return <Alert type="info" message="Verifying whitelist status..." />;
  }

  if (!isWhitelisted) {
    return (
      <Alert
        type="info"
        message="Your connected wallet is not on the airdrop whitelist."
      />
    );
  }

  const isBusy = ['loading', 'committing', 'revealing', 'cancelling'].includes(
    mintingState.status
  );
  const mintPriceWei = ethers.parseEther(mintPrice || '0');
  const insufficientSW =
    smartWalletBalance !== null && smartWalletBalance < mintPriceWei;

  // Reveal view if a commit exists
  if (commitDetails) {
    const isWaiting = currentBlock < commitDetails.earliestRevealBlock;
    const isExpired = currentBlock > commitDetails.expiryBlock;

    return (
      <div className="space-y-4 text-center">
        {renderAlerts()}
        {mintingState.status === 'stuck' && (
          <Alert type="error" message={mintingState.message!} />
        )}

        <h3 className="text-lg font-bold">Commit Found</h3>
        <p className="text-sm text-gray-400">
          An active commit from{' '}
          <span className="font-mono text-xs">{commitDetails.committer}</span>{' '}
          was found on-chain.
        </p>

        <Input
          label="Your Secret"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          disabled={mintingState.status !== 'stuck'}
          placeholder="Enter your saved 32-byte secret"
        />

        {isExpired ? (
          <div className="bg-red-900/50 p-4 rounded-lg">
            <p className="font-bold text-red-300">Commit Expired</p>
            <p className="text-xs text-red-400 mt-1">
              The reveal window has closed. Your only option is to cancel
              {commitDetails.isAirdrop ? '.' : ' and get a refund.'}
            </p>
          </div>
        ) : isWaiting ? (
          <div className="bg-blue-900/50 p-4 rounded-lg">
            <p className="font-bold text-blue-300">Waiting for Reveal Window</p>
            <p className="text-xs text-blue-400 mt-1">
              You can reveal at block{' '}
              <span className="font-mono">
                {commitDetails.earliestRevealBlock}
              </span>{' '}
              (Current: <span className="font-mono">{currentBlock}</span>)
            </p>
          </div>
        ) : (
          <div className="bg-green-900/50 p-4 rounded-lg">
            <p className="font-bold text-green-300">Ready to Reveal!</p>
            <p className="text-xs text-green-400 mt-1">
              You must reveal before block{' '}
              <span className="font-mono">{commitDetails.expiryBlock}</span>.
            </p>
          </div>
        )}

        <Button
          onClick={handleReveal}
          disabled={isWaiting || isExpired || isBusy || !secret}
        >
          {mintingState.status === 'revealing' ? (
            <Spinner />
          ) : (
            'Reveal & Mint NFT'
          )}
        </Button>

        <Button
          onClick={handleCancel}
          disabled={isBusy}
          variant="secondary"
          className="w-full"
        >
          {mintingState.status === 'cancelling' ? (
            <Spinner />
          ) : commitDetails.isAirdrop ? (
            'Cancel Commit'
          ) : (
            'Cancel & Refund'
          )}
        </Button>
      </div>
    );
  }

  // Commit view
  return (
    <div className="space-y-4">
      {renderAlerts()}

      <h3 className="text-lg font-semibold text-center">Step 1: Commit</h3>

      <Input
        label="Your Secure Secret"
        value={secret}
        onChange={(e) => setSecret(e.target.value)}
        placeholder="Click the button to generate a secret"
        disabled={isBusy}
      />

      <Button onClick={generateSecret} variant="secondary" className="w-full">
        Generate Secure Secret
      </Button>

      <div className="border-t border-gray-700 my-2" />

      <Button
        onClick={() => handleCommit(false)}
        disabled={!secret || isBusy}
        className="w-full"
      >
        {mintingState.status === 'committing' ? (
          <Spinner />
        ) : isAirdrop ? (
          'Commit to Claim Airdrop'
        ) : (
          `Commit with MetaMask (${mintPrice} ETH)`
        )}
      </Button>

      {!isAirdrop && smartWalletAddress && (
        <div className="mt-4 text-center">
          {insufficientSW && (
            <Alert
              type="error"
              message={`Your smart wallet has insufficient funds. Please send at least ${mintPrice} ETH to your smart wallet address to proceed.`}
            />
          )}
          <p className="text-xs text-gray-400 mb-2">
            Or use your smart wallet for a gas-free transaction:
          </p>
          <Button
            onClick={() => handleCommit(true)}
            disabled={!secret || isBusy || insufficientSW}
            className="w-full"
            variant="secondary"
          >
            {mintingState.status === 'committing' ? (
              <Spinner />
            ) : (
              'Commit Gaslessly via Smart Wallet'
            )}
          </Button>
          {estimatedGas && (
            <p className="text-xs text-gray-500 mt-2">
              Relayer will cover the estimated gas fee of ~{estimatedGas}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default CommitRevealForm;
