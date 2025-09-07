// api/_common.js
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
// The key change: ABIs are now part of the source code.
const { factoryAbi, walletAbi } = require("./_ABI.js");

let provider, relayerWallet, addresses;
let isInitialized = false;

// A robust loader that tries multiple paths for the addresses file.
function loadDeployedAddresses() {
  const baseName = "deployed-addresses.json";
  const candidatePaths = [
    path.join(process.cwd(), baseName), // Vercel copies `includeFiles` here.
    path.join(__dirname, "..", baseName), // Relative path from /api/_common.js to root.
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      try {
        return JSON.parse(fs.readFileSync(p, "utf8"));
      } catch (e) {
        console.error(
          `[common] Error parsing JSON from existing file: ${p}`,
          e
        );
        throw new Error(
          `Could not parse ${baseName} at ${p}. It may be corrupted.`
        );
      }
    }
  }

  // If we get here, the file was not found.
  throw new Error(
    `Deployment addresses not found. Ensure ${baseName} is committed and included in Vercel deployment.`
  );
}

async function setup() {
  if (isInitialized) {
    return {
      provider,
      relayerWallet,
      addresses,
      walletFactoryAbi: factoryAbi,
      simpleWalletAbi: walletAbi,
    };
  }

  const network = process.env.NETWORK || "sepolia";
  const RPC_URL =
    network === "sepolia"
      ? process.env.SEPOLIA_RPC_URL
      : process.env.LOCAL_RPC_URL || "http://127.0.0.1:8545";

  if (!RPC_URL)
    throw new Error(`[common] RPC URL for ${network} is not configured`);

  const RELAYER_PRIVATE_KEY =
    process.env.RELAYER_PRIVATE_KEY || process.env.PRIVATE_KEY;
  if (!RELAYER_PRIVATE_KEY)
    throw new Error("[common] RELAYER_PRIVATE_KEY (or PRIVATE_KEY) is not set");

  // Load addresses using the robust loader.
  addresses = loadDeployedAddresses();
  if (!addresses.factory || !ethers.isAddress(addresses.factory)) {
    throw new Error(
      `Invalid factory address in deployed-addresses.json: ${addresses.factory}`
    );
  }

  // ABI Validation (still useful)
  if (
    !Array.isArray(factoryAbi) ||
    factoryAbi.length === 0 ||
    !Array.isArray(walletAbi) ||
    walletAbi.length === 0
  ) {
    throw new Error(
      "ABIs are missing or empty in api/_ABI.js. This is a deployment issue. Please run the deployment script locally, commit the generated file, and re-deploy to Vercel."
    );
  }

  provider = new ethers.JsonRpcProvider(RPC_URL);
  relayerWallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);

  console.log(
    `[common] Setup complete. Relayer: ${relayerWallet.address} on network: ${network}`
  );

  isInitialized = true;
  // Return the ABIs directly from the imported module.
  return {
    provider,
    relayerWallet,
    addresses,
    walletFactoryAbi: factoryAbi,
    simpleWalletAbi: walletAbi,
  };
}

/**
 * A robust, recursive error parser to find the human-readable revert reason
 * inside nested error objects from ethers.js. This is critical for providing
 * clear feedback to the frontend (e.g., "insufficient funds" instead of a generic error).
 * @param {any} err The error object to parse.
 * @returns {string|null} The extracted revert reason or null if not found.
 */
const findRevertReason = (err) => {
  if (!err) return null;

  // Handle plain string errors first
  if (typeof err === "string") {
    // Look for common revert patterns in the string
    const revertMatch = err.match(/reverted with reason string '([^']*)'/);
    if (revertMatch && revertMatch[1]) return revertMatch[1];

    const execRevertMatch = err.match(/execution reverted: ([^"]*)/);
    if (execRevertMatch && execRevertMatch[1]) return execRevertMatch[1];

    return null; // Don't return the full string if it's not a clear revert reason
  }

  if (typeof err !== "object") return null;

  // Standard Ethers v6+ reason property
  if (err.reason) return err.reason;

  // Recursively search nested properties where revert reasons are often buried
  return (
    findRevertReason(err.error) ||
    findRevertReason(err.data) ||
    findRevertReason(err.message)
  );
};

// Centralized error response
const handleTransactionError = (error, res) => {
  console.error("--- API Transaction Error ---");
  // Log the full error object for server-side debugging
  console.error(JSON.stringify(error, null, 2));

  const reason = findRevertReason(error);
  // Fallback to a generic message if no specific reason can be found
  const safeMsg =
    reason ||
    (error && error.message) ||
    "An unexpected internal server error occurred.";

  // Default to 500 but adjust for common client-side errors if possible
  let status = 500;
  const lowerCaseMsg = safeMsg.toLowerCase();

  // User-correctable errors should return a 4xx status code
  if (
    lowerCaseMsg.includes("invalid") ||
    lowerCaseMsg.includes("required") ||
    lowerCaseMsg.includes("nonce") ||
    lowerCaseMsg.includes("insufficient funds")
  ) {
    status = 400; // Bad Request
  }
  // State-related errors can return a 409 Conflict
  if (
    lowerCaseMsg.includes("sale not active") ||
    lowerCaseMsg.includes("already exists")
  ) {
    status = 409;
  }

  res.status(status).json({ success: false, error: safeMsg });
};

module.exports = { setup, handleTransactionError };
