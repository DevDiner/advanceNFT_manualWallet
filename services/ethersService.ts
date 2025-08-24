// src/services/ethersService.ts
import { BrowserProvider, JsonRpcProvider, Contract } from "ethers";
import { CONTRACT_ADDRESS } from "../constants";
import config from "../config";
// import the real ABI created by Hardhat
import AdvancedNFT from "../artifacts/contracts/AdvancedNFT.sol/AdvancedNFT.json";

const EXPECTED_CHAIN_ID = config.chainIdBig;      // ie: 31337     
const RPC_URL = config.rpcUrl || "http://127.0.0.1:8545";

let _readOnly: JsonRpcProvider | null = null;

/** Prefer a fixed JSON-RPC for reads (prevents wallet-on-wrong-network issues) */
export const getReadOnlyProvider = (): JsonRpcProvider => {
  _readOnly ||= new JsonRpcProvider(RPC_URL);
  return _readOnly;
};

/** Wallet provider for txs. Enforce the expected chain. */
export const getProvider = async (): Promise<BrowserProvider> => {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("No wallet found. Please install a web3 wallet like MetaMask.");
  }
  const provider = new BrowserProvider(window.ethereum);
  const net = await provider.getNetwork();
  if (net.chainId !== EXPECTED_CHAIN_ID) {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x" + EXPECTED_CHAIN_ID.toString(16) }],
      });
    } catch (e: any) {
      if (e?.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: "0x" + EXPECTED_CHAIN_ID.toString(16),
            chainName: config.networkName || "Localhost 8545",
            nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
            rpcUrls: [RPC_URL],
          }],
        });
      } else {
        throw new Error(`Wrong network (${net.chainId}). Please switch to ${config.networkName} (${config.chainId}).`);
      }
    }
  }
  return provider;
};

export const getSigner = async () => {
  const provider = await getProvider();
  return provider.getSigner();
};

/** Read-only contract */
export const getContract = () => {
  const provider = getReadOnlyProvider();
  return new Contract(CONTRACT_ADDRESS, AdvancedNFT.abi, provider);
};

/** Signer-backed contract */
export const getContractWithSigner = async () => {
  const signer = await getSigner();
  return new Contract(CONTRACT_ADDRESS, AdvancedNFT.abi, signer);
};

/** Call once on init to fail fast if address is wrong */
export const assertContractDeployed = async () => {
  const provider = getReadOnlyProvider();
  const code = await provider.send("eth_getCode", [CONTRACT_ADDRESS, "latest"]);
  if (code === "0x") {
    throw new Error(`No contract deployed at ${CONTRACT_ADDRESS} on ${RPC_URL}`);
  }
};
