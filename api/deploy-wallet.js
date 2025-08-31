// api/deploy-wallet.js
const { ethers } = require("ethers");
const { setup, handleTransactionError } = require("./_common");

module.exports = async (req, res) => {
  // Set CORS headers to allow requests from any origin
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle pre-flight OPTIONS request for CORS
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Ensure only POST requests are processed
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

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
};
