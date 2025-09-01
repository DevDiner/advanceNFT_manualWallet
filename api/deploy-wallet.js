// api/deploy-wallet.js
const { ethers } = require("ethers");
const { setup, handleTransactionError } = require("./_common");

module.exports = async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const { walletFactoryAbi, addresses, relayerWallet } = await setup();
    const factory = new ethers.Contract(
      addresses.factory,
      walletFactoryAbi,
      relayerWallet
    );

    const { owner } = req.body || {};
    if (!owner || !ethers.isAddress(owner)) {
      return res
        .status(400)
        .json({ success: false, error: "Valid 'owner' address is required." });
    }

    console.log(`[api/deploy-wallet] Request received for owner ${owner}`);

    // Prevent duplicate wallets
    const existing = await factory.walletOf(owner);
    if (existing && existing !== ethers.ZeroAddress) {
      console.warn(`[api/deploy-wallet] Wallet already exists at ${existing}`);
      return res
        .status(409)
        .json({
          success: false,
          error: "Wallet already exists",
          walletAddress: existing,
        });
    }

    const tx = await factory.createWallet(owner);
    console.log(`[api/deploy-wallet] Tx sent: ${tx.hash}`);
    await tx.wait();

    const walletAddress = await factory.walletOf(owner);
    console.log(`[api/deploy-wallet] ✅ Deployed to ${walletAddress}`);
    return res.status(200).json({ success: true, walletAddress });
  } catch (error) {
    return handleTransactionError(error, res);
  }
};
