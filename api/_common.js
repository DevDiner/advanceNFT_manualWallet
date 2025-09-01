// api/_common.js
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

// --- State Variables ---
// We cache these values so they don't have to be re-initialized on every
// single serverless function invocation, which is more efficient.
let provider, relayerWallet, addresses, walletFactoryAbi, simpleWalletAbi;
let isInitialized = false;

/**
 * Initializes all the necessary blockchain connections and contract ABIs.
 * This is designed to be called at the start of each serverless function.
 * It uses a simple flag to ensure the setup logic only runs once per "cold start"
 * of the serverless function, improving performance.
 */
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

  // --- Configuration & Validation ---
  const network = process.env.NETWORK || "sepolia"; // Default to Sepolia for Vercel
  const RPC_URL =
    network === "sepolia"
      ? process.env.SEPOLIA_RPC_URL
      : "http://127.0.0.1:8545";

  if (!RPC_URL) {
    throw new Error(
      `RPC URL for ${network} is not configured in environment variables.`
    );
  }

  const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;
  if (!RELAYER_PRIVATE_KEY) {
    throw new Error(
      "FATAL: RELAYER_PRIVATE_KEY is not set in environment variables."
    );
  }

  // --- ROBUST PATHING FOR VERCEL RUNTIME ---
  // The serverless function runs from /var/task/api, but the included files are at /var/task.
  // We must use `__dirname` to build a reliable path up one level to the project root.
  const rootDir = path.resolve(__dirname, "..");
  const addressesPath = path.join(rootDir, "deployed-addresses.json");
  const apiArtifactsPath = path.join(rootDir, "api-artifacts.json");

  if (!fs.existsSync(addressesPath) || !fs.existsSync(apiArtifactsPath)) {
    throw new Error(
      "Deployment artifacts (addresses or ABIs) not found. Run the deployment script and commit the generated files."
    );
  }

  addresses = JSON.parse(fs.readFileSync(addressesPath, "utf8"));
  const { factoryAbi, walletAbi } = JSON.parse(
    fs.readFileSync(apiArtifactsPath, "utf8")
  );

  if (
    !factoryAbi ||
    factoryAbi.length === 0 ||
    !walletAbi ||
    walletAbi.length === 0
  ) {
    throw new Error(
      "ABIs in api-artifacts.json are missing or empty. Run the deployment script to generate them."
    );
  }

  walletFactoryAbi = factoryAbi;
  simpleWalletAbi = walletAbi;

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

/**
 * A centralized, robust error handler for all API endpoints.
 * It parses complex ethers.js errors to find the specific revert reason and
 * returns a clear, actionable error message to the frontend.
 */
const handleTransactionError = (error, res) => {
  console.error("--- Transaction Error ---");
  // Use a deep inspection of the error object for better debugging.
  console.error(JSON.stringify(error, null, 2));

  let errorMessage = "An internal server error occurred.";
  let statusCode = 500;

  if (error.code === "INSUFFICIENT_FUNDS") {
    errorMessage = "Relayer is out of funds. Please notify the administrator.";
    statusCode = 503; // Service Unavailable
  } else if (error.reason) {
    // The revert reason from the smart contract
    errorMessage = error.reason;
    statusCode = 400; // Bad Request (contract logic failure)
  } else if (error.message) {
    errorMessage = error.message;
  }

  console.error(`Responding with status ${statusCode}: ${errorMessage}`);
  res.status(statusCode).json({ success: false, error: errorMessage });
};

module.exports = { setup, handleTransactionError };
