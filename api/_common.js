// api/_common.js
const { ethers } = require("ethers");
const { existsSync, readFileSync } = require("fs");
const { join } = require("path");

// Cached state (persists for the life of the serverless instance)
let provider, relayerWallet, addresses, walletFactoryAbi, simpleWalletAbi;
let isInitialized = false;

// Helper: try several likely paths for an included file
function candidates(file) {
  return [
    // typical location when included by vercel "includeFiles"
    join(process.cwd(), file),
    // parent of this file (api/_common.js -> ..)
    join(__dirname, "..", file),
    // same folder as this file (if you move things later)
    join(__dirname, file),
  ];
}

function findFile(file) {
  for (const p of candidates(file)) {
    if (existsSync(p)) {
      console.log(`[common] Using ${file}: ${p}`);
      return p;
    }
  }
  return null;
}

async function setup() {
  if (isInitialized) {
    return {
      provider,
      relayerWallet,
      addresses,
      walletFactoryAbi,
      simpleWalletAbi,
    };
  }

  // ----- Env & network selection
  const network = process.env.NETWORK || "sepolia";
  const RPC_URL =
    network === "sepolia"
      ? process.env.SEPOLIA_RPC_URL
      : "http://127.0.0.1:8545";
  if (!RPC_URL) throw new Error(`RPC URL for ${network} is not configured.`);

  const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;
  if (!RELAYER_PRIVATE_KEY) throw new Error("RELAYER_PRIVATE_KEY is not set.");

  // ----- Locate bundled JSON artifacts
  const addressesPath = findFile("deployed-addresses.json");
  const apiArtifactsPath = findFile("api-artifacts.json");
  if (!addressesPath || !apiArtifactsPath) {
    throw new Error(
      "Deployment artifacts not found. Re-run your deploy script to regenerate " +
        "deployed-addresses.json and api-artifacts.json, commit them, and redeploy."
    );
  }

  // ----- Parse addresses
  const addressesJson = readFileSync(addressesPath, "utf8");
  try {
    addresses = JSON.parse(addressesJson);
  } catch {
    console.error("deployed-addresses.json is malformed:\n", addressesJson);
    throw new Error(
      "Server configuration error: deployed-addresses.json is malformed."
    );
  }

  // ----- Parse ABIs
  const artifactsRaw = readFileSync(apiArtifactsPath, "utf8");
  let artifacts;
  try {
    artifacts = JSON.parse(artifactsRaw);
  } catch {
    console.error("api-artifacts.json is malformed:\n", artifactsRaw);
    throw new Error(
      "Server configuration error: api-artifacts.json is malformed."
    );
  }

  const { factoryAbi, walletAbi } = artifacts;
  if (
    !Array.isArray(factoryAbi) ||
    factoryAbi.length === 0 ||
    !Array.isArray(walletAbi) ||
    walletAbi.length === 0
  ) {
    console.error(
      "--- Deployed api-artifacts.json ---\n",
      artifactsRaw,
      "\n-----------------------------------"
    );
    throw new Error(
      "Server configuration error: ABI definitions are missing. " +
        "Run the deploy script to regenerate api-artifacts.json, commit it, and redeploy."
    );
  }

  walletFactoryAbi = factoryAbi;
  simpleWalletAbi = walletAbi;

  // ----- Chain connections
  provider = new ethers.JsonRpcProvider(RPC_URL);
  relayerWallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);

  console.log(`Common setup initialized for network: ${network}`);
  console.log(`Relayer address: ${relayerWallet.address}`);

  isInitialized = true;
  return {
    provider,
    relayerWallet,
    addresses,
    walletFactoryAbi,
    simpleWalletAbi,
  };
}

// Centralized error handler for all API routes
function handleTransactionError(error, res) {
  console.error("--- Transaction Error ---");
  try {
    console.error(JSON.stringify(error, null, 2));
  } catch {
    console.error(error);
  }

  let status = 500;
  let message = "An internal server error occurred.";

  if (error.code === "INSUFFICIENT_FUNDS") {
    status = 503;
    message = "Relayer is out of funds. Please try again later.";
  } else if (error.reason) {
    status = 400;
    message = error.reason;
  } else if (error.message) {
    message = error.message;
  }

  console.error(`Responding with ${status}: ${message}`);
  res.status(status).json({ success: false, error: message });
}

module.exports = { setup, handleTransactionError };
