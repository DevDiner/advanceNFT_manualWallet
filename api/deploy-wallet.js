// api/deploy-wallet.js
const express = require("express");
const cors = require("cors");
const { ethers } = require("ethers");
const { setup, handleTransactionError } = require("./_common");

// Create an Express app
const app = express();
app.use(cors());
app.use(express.json());

// This single handler will be executed by Vercel.
app.post("*", async (req, res) => {
  try {
    const { walletFactoryAbi, addresses, relayerWallet } = await setup();
    const walletFactoryContract = new ethers.Contract(
      addresses.factory,
      walletFactoryAbi,
      relayerWallet
    );

    const { owner } = req.body;
    if (!owner || !ethers.isAddress(owner)) {
      return res
        .status(400)
        .json({ error: "Valid 'owner' address is required." });
    }
    console.log(`\n[api/deploy-wallet] Received request for: ${owner}`);

    const existingWallet = await walletFactoryContract.walletOf(owner);
    if (existingWallet !== ethers.ZeroAddress) {
      console.warn(
        `[api/deploy-wallet] Wallet already exists for ${owner} at ${existingWallet}`
      );
      return res.status(409).json({
        // 409 Conflict
        success: false,
        error: "A smart wallet for this account already exists.",
        walletAddress: existingWallet,
      });
    }

    const tx = await walletFactoryContract.createWallet(owner);
    console.log(`[api/deploy-wallet] Deployment tx sent. Hash: ${tx.hash}`);
    await tx.wait();
    const smartWalletAddress = await walletFactoryContract.walletOf(owner);
    console.log(
      `[api/deploy-wallet] ✅ Wallet for ${owner} deployed to: ${smartWalletAddress}`
    );
    res.status(200).json({ success: true, walletAddress: smartWalletAddress });
  } catch (error) {
    handleTransactionError(error, res);
  }
});

// Export the app for Vercel to use
module.exports = app;
