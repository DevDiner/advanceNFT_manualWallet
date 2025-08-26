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
// This block ensures all necessary configuration and files are present before starting the server.

const RPC_URL = process.env.SEPOLIA_RPC_URL || "http://127.0.0.1:8545";
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;

if (!RELAYER_PRIVATE_KEY) {
  console.error("\n❌ FATAL: RELAYER_PRIVATE_KEY is not set in the .env file.");
  console.error(
    "   The relayer server cannot start without a wallet to pay for gas."
  );
  console.error(
    "   Please create a `.env` file from `.env.example` and add your key.\n"
  );
  process.exit(1);
}

let walletAddress, walletAbi;
try {
  const artifactPath = path.join(
    __dirname,
    "..",
    "artifacts",
    "contracts",
    "SimpleWallet.sol",
    "SimpleWallet.json"
  );
  if (!fs.existsSync(artifactPath)) {
    throw new Error(
      "Contract artifact not found. The relayer needs the contract's ABI.\n\n   >>> Please compile contracts first by running: npm run compile\n"
    );
  }
  const contractArtifact = JSON.parse(fs.readFileSync(artifactPath));
  walletAbi = contractArtifact.abi;

  const addressesPath = path.join(__dirname, "..", "deployed-addresses.json");
  if (!fs.existsSync(addressesPath)) {
    throw new Error(
      "Deployment file not found. The relayer needs to know the contract address.\n\n   >>> Please deploy contracts first by running:\n       - 'npm run deploy' for local testing\n       - 'npm run deploy:sepolia' for the testnet\n"
    );
  }
  const addresses = JSON.parse(fs.readFileSync(addressesPath));
  walletAddress = addresses.wallet;

  if (!walletAddress || !walletAbi)
    throw new Error(
      "Missing address or ABI in deployment files. Please try recompiling and redeploying."
    );
} catch (e) {
  console.error(`\n❌ FATAL: ${e.message}`);
  process.exit(1);
}

// --- 2. Server Initialization ---

const provider = new ethers.JsonRpcProvider(RPC_URL);
const relayerWallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);
const simpleWalletContract = new ethers.Contract(
  walletAddress,
  walletAbi,
  relayerWallet
);

console.log(`Relayer server starting...`);
console.log(`- RPC Endpoint: ${RPC_URL}`);
console.log(`- Relayer Wallet Address: ${relayerWallet.address}`);
console.log(`- SimpleWallet Contract: ${walletAddress}`);

app.get("/", (req, res) => {
  res.send(`Relayer is healthy. Address: ${relayerWallet.address}`);
});

app.post("/relay", async (req, res) => {
  let { from, to, value, data, signature, nonce } = req.body;
  try {
    if (typeof value == "string") value = BigInt(value);
    if (typeof nonce == "string") nonce = BigInt(nonce);
  } catch {
    return res.status(400).json({ error: "Bad numeric fields" });
  }
  console.log("\nReceived relay request:");
  console.log({ from, to, value, data });

  try {
    // Basic validation
    if (!from || !to || !value || !data || !signature) {
      return res
        .status(400)
        .json({ error: "Missing required fields in relay request." });
    }

    console.log("Submitting meta-transaction to the SimpleWallet contract...");
    const tx = await simpleWalletContract.executeMetaTransaction(
      from,
      to,
      value,
      data,
      signature,
      {
        gasLimit: 150000, // Provide a reasonable gas limit
      }
    );

    console.log(`Transaction sent by relayer. Hash: ${tx.hash}`);
    console.log("Waiting for confirmation...");

    await tx.wait();

    console.log(`✅ Meta-transaction successfully relayed and confirmed!`);
    res.status(200).json({ success: true, txHash: tx.hash });
  } catch (error) {
    console.error("Error relaying transaction:", error.reason || error.message);
    res.status(500).json({
      success: false,
      error: error.reason || "An internal error occurred.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Relayer server is running on http://localhost:${PORT}`);
});
