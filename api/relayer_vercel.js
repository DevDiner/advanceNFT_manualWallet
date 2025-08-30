// This file is now at /api/relay.js
require("dotenv").config({ path: "../.env" }); // Important: Tell it where to find .env in the root
const express = require("express");
const { ethers } = require("ethers");
const cors = require("cors"); // Add cors for frontend requests

// Load contract ABI from Hardhat artifacts
const SimpleWalletArtifact = require("../artifacts/contracts/SimpleWallet.sol/SimpleWallet.json");
const walletAbi = SimpleWalletArtifact.abi;

// --- Vercel requires the app to be exported ---
const app = express();

// --- Middleware ---
app.use(cors()); // Allow requests from any origin (your frontend)
app.use(express.json());

// --- Configuration ---
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL;
const RELAYER_PRIVATE_KEY = process.env.PRIVATE_KEY;
const WALLET_CONTRACT_ADDRESS = require("../deployed-addresses.json").wallet;

// --- Main Serverless Function Logic ---
app.post("*", async (req, res) => {
  // Check for missing config
  if (!RELAYER_PRIVATE_KEY || !SEPOLIA_RPC_URL || !WALLET_CONTRACT_ADDRESS) {
    console.error("Missing required environment variables.");
    return res
      .status(500)
      .json({ success: false, message: "Server configuration error." });
  }

  try {
    const { from, to, value, data, signature } = req.body;

    // Basic validation
    if (!from || !to || !value || !data || !signature) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameters in request body.",
      });
    }

    const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
    const relayerWallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);
    const walletContract = new ethers.Contract(
      WALLET_CONTRACT_ADDRESS,
      walletAbi,
      relayerWallet
    );

    console.log(`Relaying transaction for: ${from}`);

    const tx = await walletContract.executeMetaTransaction(
      from,
      to,
      value,
      data,
      signature
    );
    console.log(`Transaction sent! Hash: ${tx.hash}`);

    // We don't wait for confirmation to provide a faster response to the user.
    // The frontend can track the tx hash.
    res.status(200).json({ success: true, txHash: tx.hash });
  } catch (error) {
    console.error("Relay failed:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Export the app for Vercel
module.exports = app;
