// api/_common.js
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

let provider, relayerWallet, addresses, walletFactoryAbi, simpleWalletAbi;
let isInitialized = false;

function readJsonIfExists(p) {
  try {
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, "utf8");
      return { json: JSON.parse(raw), raw, pathUsed: p };
    }
  } catch (e) {
    console.error(`[common] Failed reading/parsing ${p}:`, e.message);
  }
  return null;
}

function loadArtifacts() {
  const tried = [];

  // 1) Prefer a direct require (bundlers include this automatically)
  try {
    // Path from /api/*.js -> root
    const mod = require("../api-artifacts.json");
    return {
      json: mod,
      raw: JSON.stringify(mod),
      pathUsed: "../api-artifacts.json (require)",
      tried,
    };
  } catch (e) {
    tried.push("../api-artifacts.json (require): " + e.message);
  }

  // 2) Local to the function directory
  const local = path.join(__dirname, "api-artifacts.json");
  const localHit = readJsonIfExists(local);
  if (localHit) return { ...localHit, tried };

  // 3) Project root (Vercel copies includeFiles to function root or /var/task)
  const roots = [
    path.join(process.cwd(), "api-artifacts.json"),
    "/var/task/api-artifacts.json",
    "/var/task/user/api-artifacts.json",
  ];
  for (const p of roots) {
    const hit = readJsonIfExists(p);
    if (hit) return { ...hit, tried };
    tried.push(p);
  }

  return { json: null, raw: "", pathUsed: null, tried };
}

function loadAddresses() {
  const tried = [];

  try {
    const mod = require("../deployed-addresses.json");
    return {
      json: mod,
      pathUsed: "../deployed-addresses.json (require)",
      tried,
    };
  } catch (e) {
    tried.push("../deployed-addresses.json (require): " + e.message);
  }

  const candidates = [
    path.join(__dirname, "deployed-addresses.json"),
    path.join(process.cwd(), "deployed-addresses.json"),
    "/var/task/deployed-addresses.json",
    "/var/task/user/deployed-addresses.json",
  ];
  for (const p of candidates) {
    const hit = readJsonIfExists(p);
    if (hit) return { json: hit.json, pathUsed: p, tried };
    tried.push(p);
  }

  return { json: null, pathUsed: null, tried };
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

  if (!RPC_URL)
    throw new Error(`[common] RPC URL for ${network} is not configured`);

  const RELAYER_PRIVATE_KEY =
    process.env.RELAYER_PRIVATE_KEY || process.env.PRIVATE_KEY;
  if (!RELAYER_PRIVATE_KEY)
    throw new Error("[common] RELAYER_PRIVATE_KEY (or PRIVATE_KEY) is not set");

  // ---- addresses.json
  const addrLoad = loadAddresses();
  if (!addrLoad.json) {
    console.error(
      "[common] Could not find deployed-addresses.json. Tried:",
      addrLoad.tried
    );
    throw new Error(
      "Deployment addresses not found. Re-run deploy and commit deployed-addresses.json"
    );
  }
  addresses = addrLoad.json;
  console.log(`[common] Using deployed-addresses from: ${addrLoad.pathUsed}`);
  if (!addresses.factory || !ethers.isAddress(addresses.factory)) {
    throw new Error("Invalid factory address in deployed-addresses.json");
  }

  // ---- api-artifacts.json (ABIs)
  const artLoad = loadArtifacts();
  if (!artLoad.json) {
    console.error(
      "[common] Could not find api-artifacts.json. Tried:",
      artLoad.tried
    );
    throw new Error(
      "ABI file api-artifacts.json not found. Re-run deploy and commit it"
    );
  }
  console.log(`[common] Using api-artifacts from: ${artLoad.pathUsed}`);

  // Validate shape
  const { factoryAbi, walletAbi } = artLoad.json || {};
  if (
    !Array.isArray(factoryAbi) ||
    factoryAbi.length === 0 ||
    !Array.isArray(walletAbi) ||
    walletAbi.length === 0
  ) {
    console.error("[common] Bad ABI file contents:", {
      factoryAbiType: typeof factoryAbi,
      factoryAbiLen: Array.isArray(factoryAbi) ? factoryAbi.length : "n/a",
      walletAbiType: typeof walletAbi,
      walletAbiLen: Array.isArray(walletAbi) ? walletAbi.length : "n/a",
    });
    throw new Error(
      "ABIs in api-artifacts.json are missing or empty. Run the deployment script to generate them."
    );
  }

  walletFactoryAbi = factoryAbi;
  simpleWalletAbi = walletAbi;

  provider = new ethers.JsonRpcProvider(RPC_URL);
  relayerWallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);

  console.log(`[common] Network=${network} RPC=${RPC_URL}`);
  console.log(`[common] Relayer=${relayerWallet.address}`);
  console.log(
    `[common] ABI lengths => factory: ${factoryAbi.length}, wallet: ${walletAbi.length}`
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

// Centralized error response
const handleTransactionError = (error, res) => {
  // Errors stringify to {}, so fall back to message & stack explicitly
  const safeMsg =
    (error && (error.reason || error.message)) || "Internal server error";
  console.error("--- Transaction Error ---");
  if (error && error.stack) console.error(error.stack);
  else console.error(error);

  let status = 500;
  if (safeMsg.includes("ABIs") || safeMsg.includes("addresses")) status = 500;
  if (safeMsg.includes("not set") || safeMsg.includes("not configured"))
    status = 500;
  if (safeMsg.includes("Invalid") || safeMsg.includes("Bad ABI")) status = 400;

  res.status(status).json({ success: false, error: safeMsg });
};

module.exports = { setup, handleTransactionError };
