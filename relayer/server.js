const express = require("express");
const { ethers } = require("ethers");
const cors = require("cors");
require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3001;

// --- 1. Startup Validation ---
// FIX: The relayer's RPC URL is now determined by a dedicated `NETWORK` env var,
// making it independent of the frontend config and more robust.
const network = process.env.NETWORK || "localhost";
const RPC_URL =
  network === "sepolia" ? process.env.SEPOLIA_RPC_URL : "http://127.0.0.1:8545";

if (network === "sepolia" && !process.env.SEPOLIA_RPC_URL) {
  console.warn(
    "\n🚨 WARNING: SEPOLIA_RPC_URL is not set in .env. Relayer will not work for Sepolia."
  );
}

const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;
if (!RELAYER_PRIVATE_KEY) {
  console.error("\n❌ FATAL: RELAYER_PRIVATE_KEY is not set in the .env file.");
  process.exit(1);
}

let addresses, walletFactoryAbi, simpleWalletAbi;
try {
  const addressesPath = path.join(__dirname, "..", "deployed-addresses.json");
  if (!fs.existsSync(addressesPath)) {
    throw new Error(
      "Deployment file not found.\n\n   >>> Please deploy contracts first by running: 'npm run deploy'"
    );
  }
  addresses = JSON.parse(fs.readFileSync(addressesPath));

  const factoryArtifactPath = path.join(
    __dirname,
    "..",
    "artifacts",
    "contracts",
    "SimpleWalletFactory.sol",
    "SimpleWalletFactory.json"
  );
  const walletArtifactPath = path.join(
    __dirname,
    "..",
    "artifacts",
    "contracts",
    "SimpleWallet.sol",
    "SimpleWallet.json"
  );
  if (
    !fs.existsSync(factoryArtifactPath) ||
    !fs.existsSync(walletArtifactPath)
  ) {
    throw new Error(
      "Contract artifacts not found.\n\n   >>> Please compile contracts first by running: npm run compile"
    );
  }
  walletFactoryAbi = JSON.parse(fs.readFileSync(factoryArtifactPath)).abi;
  simpleWalletAbi = JSON.parse(fs.readFileSync(walletArtifactPath)).abi;
} catch (e) {
  console.error(`\n❌ FATAL: ${e.message}`);
  process.exit(1);
}

// --- 2. Server Initialization ---
const provider = new ethers.JsonRpcProvider(RPC_URL);
const relayerWallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);
const walletFactoryContract = new ethers.Contract(
  addresses.factory,
  walletFactoryAbi,
  relayerWallet
);

// --- 3. Enhanced Error Handling Utility ---
const handleTransactionError = (error, res) => {
  console.error("--- Transaction Error ---");
  console.error("Full Error Object:", JSON.stringify(error, null, 2));

  let errorMessage = "An internal server error occurred.";
  let statusCode = 500;

  if (error.code === "INSUFFICIENT_FUNDS") {
    errorMessage = "Relayer is out of funds. Please notify the administrator.";
    statusCode = 503; // Service Unavailable
  } else if (error.reason) {
    // This is often the revert reason from the smart contract
    errorMessage = error.reason;
    statusCode = 400; // Bad Request, as it's likely a contract logic failure
  } else if (error.message) {
    errorMessage = error.message;
  }

  console.error(`Responding with status ${statusCode}: ${errorMessage}`);
  res.status(statusCode).json({ success: false, error: errorMessage });
};

console.log(`Relayer server starting...`);
console.log(`- Network: ${network}`);
console.log(`- RPC URL: ${RPC_URL}`);
console.log(`- Relayer Wallet Address: ${relayerWallet.address}`);
console.log(`- Wallet Factory Contract: ${addresses.factory}`);

app.get("/", (req, res) => {
  res.send(`Relayer is healthy. Address: ${relayerWallet.address}`);
});

app.post("/deploy-wallet", async (req, res) => {
  const { owner } = req.body;
  if (!owner || !ethers.isAddress(owner)) {
    return res
      .status(400)
      .json({ error: "Valid 'owner' address is required." });
  }
  console.log(`\nReceived request to deploy a smart wallet for: ${owner}`);
  try {
    // --- Proactively check if a wallet already exists ---
    const existingWallet = await walletFactoryContract.walletOf(owner);
    if (existingWallet !== ethers.ZeroAddress) {
      console.warn(
        `Attempted to create a wallet for ${owner}, but one already exists at ${existingWallet}`
      );
      return res.status(409).json({
        // 409 Conflict
        success: false,
        error: "A smart wallet for this account already exists.",
        walletAddress: existingWallet,
      });
    }

    const tx = await walletFactoryContract.createWallet(owner);
    console.log(`Deployment transaction sent by relayer. Hash: ${tx.hash}`);
    await tx.wait();
    const smartWalletAddress = await walletFactoryContract.walletOf(owner);
    console.log(
      `✅ Smart wallet for ${owner} deployed to: ${smartWalletAddress}`
    );
    res.status(200).json({ success: true, walletAddress: smartWalletAddress });
  } catch (error) {
    handleTransactionError(error, res);
  }
});

app.post("/relay", async (req, res) => {
  const { from, to, value, data, signature, smartWalletAddress } = req.body;

  // --- Rigorous Input Validation ---
  if (!from || !ethers.isAddress(from))
    return res.status(400).json({ error: "Valid 'from' address is required." });
  if (!to || !ethers.isAddress(to))
    return res.status(400).json({ error: "Valid 'to' address is required." });
  if (!smartWalletAddress || !ethers.isAddress(smartWalletAddress))
    return res
      .status(400)
      .json({ error: "Valid 'smartWalletAddress' is required." });
  if (value === undefined)
    return res.status(400).json({ error: "'value' is required." });
  if (!data || !ethers.isBytesLike(data))
    return res
      .status(400)
      .json({ error: "Valid 'data' (bytes hex string) is required." });
  if (!signature || !ethers.isBytesLike(signature))
    return res
      .status(400)
      .json({ error: "Valid 'signature' (bytes hex string) is required." });

  console.log("\nReceived relay request for smart wallet:", smartWalletAddress);
  try {
    const simpleWalletContract = new ethers.Contract(
      smartWalletAddress,
      simpleWalletAbi,
      relayerWallet
    );
    // FIX: Remove the hardcoded gas limit to allow ethers to automatically estimate it.
    // This is more robust and prevents "out of gas" errors for complex transactions like the mint.
    const tx = await simpleWalletContract.executeMetaTransaction(
      from,
      to,
      ethers.toBigInt(value),
      data,
      signature
    );
    console.log(`Transaction sent by relayer. Hash: ${tx.hash}`);
    await tx.wait();
    console.log(`✅ Meta-transaction successfully relayed and confirmed!`);
    res.status(200).json({ success: true, txHash: tx.hash });
  } catch (error) {
    handleTransactionError(error, res);
  }
});

app.listen(PORT, () => {
  console.log(`✅ Relayer server is running on http://localhost:${PORT}`);
});
