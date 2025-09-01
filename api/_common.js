// api/_common.js
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

let provider, relayerWallet, addresses, walletFactoryAbi, simpleWalletAbi;
let isInitialized = false;

// robust loader that tries multiple candidate locations inside a Vercel Lambda
function loadJsonFromCandidates(name) {
  const candidates = [
    // 1) next to the function bundle (where includeFiles usually land)
    path.join(__dirname, name),
    // 2) Lambda working directory
    path.join(process.cwd(), name),
    // 3) repo root relative to api/ (works in local dev / vercel dev)
    path.join(__dirname, "..", name),
  ];

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, "utf8");
        if (raw && raw.trim().length > 0) {
          console.log(`[api/_common] Loaded ${name} from: ${p}`);
          return JSON.parse(raw);
        }
      }
    } catch (e) {
      // keep trying next candidate
    }
  }
  console.error(`[api/_common] FAILED to load ${name}. Checked:`, candidates);
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

  const network = process.env.NETWORK || "sepolia";
  const RPC_URL =
    network === "sepolia"
      ? process.env.SEPOLIA_RPC_URL
      : process.env.LOCAL_RPC_URL || "http://127.0.0.1:8545";

  if (!RPC_URL) {
    throw new Error(
      `RPC URL for ${network} is not configured in environment variables.`
    );
  }

  // IMPORTANT: env name must match what you set in Vercel
  const RELAYER_PRIVATE_KEY =
    process.env.RELAYER_PRIVATE_KEY || process.env.PRIVATE_KEY;
  if (!RELAYER_PRIVATE_KEY) {
    throw new Error("RELAYER_PRIVATE_KEY is not set in environment variables.");
  }

  // Load files from multiple candidate paths
  const addressesJson = loadJsonFromCandidates("deployed-addresses.json");
  const apiArtifactsJson = loadJsonFromCandidates("api-artifacts.json");

  if (!addressesJson) {
    throw new Error(
      "Deployment addresses file not found. Re-run deployment and commit `deployed-addresses.json`."
    );
  }
  if (!apiArtifactsJson) {
    throw new Error(
      "ABI artifacts file not found. Re-run deployment and commit `api-artifacts.json`."
    );
  }

  const { factoryAbi, walletAbi } = apiArtifactsJson;
  if (
    !Array.isArray(factoryAbi) ||
    factoryAbi.length === 0 ||
    !Array.isArray(walletAbi) ||
    walletAbi.length === 0
  ) {
    console.error("--- Contents of api-artifacts.json (truncated) ---");
    console.error(JSON.stringify(apiArtifactsJson).slice(0, 500) + " ...");
    throw new Error(
      "ABIs are missing or empty inside api-artifacts.json. Re-run deploy to regenerate and commit it."
    );
  }

  addresses = addressesJson;
  walletFactoryAbi = factoryAbi;
  simpleWalletAbi = walletAbi;

  provider = new ethers.JsonRpcProvider(RPC_URL);
  relayerWallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);

  console.log(
    `[api/_common] Initialized. Network=${network}, Relayer=${relayerWallet.address}`
  );
  isInitialized = true;
  return {
    provider,
    relayerWallet,
    addresses,
    walletFactoryAbi,
    simpleWalletAbi,
  };
}

const handleTransactionError = (error, res) => {
  console.error("--- Transaction Error ---");
  console.error(JSON.stringify(error, null, 2));

  let status = 500;
  let msg = "Internal server error.";

  if (error.code === "INSUFFICIENT_FUNDS") {
    status = 503;
    msg = "Relayer is out of funds.";
  } else if (error.reason) {
    status = 400;
    msg = error.reason;
  } else if (error.message) {
    msg = error.message;
  }

  res.status(status).json({ success: false, error: msg });
};

module.exports = { setup, handleTransactionError };
