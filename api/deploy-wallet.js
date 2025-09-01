// api/deploy-wallet.js
const { ethers } = require("ethers");
const { setup, handleTransactionError } = require("./_common");

module.exports = async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).end(`Method ${req.method} Not Allowed`);

  try {
    const { walletFactoryAbi, addresses, relayerWallet } = await setup();

    const { owner } = req.body || {};
    if (!owner || !ethers.isAddress(owner)) {
      return res
        .status(400)
        .json({ success: false, error: "Valid 'owner' address is required." });
    }

    console.log(`[deploy-wallet] Request for ${owner}`);
    const factory = new ethers.Contract(
      addresses.factory,
      walletFactoryAbi,
      relayerWallet
    );

    const existing = await factory.walletOf(owner);
    if (existing && existing !== ethers.ZeroAddress) {
      console.warn(`[deploy-wallet] Wallet exists for ${owner}: ${existing}`);
      return res
        .status(409)
        .json({
          success: false,
          walletAddress: existing,
          error: "Wallet already exists",
        });
    }

    const tx = await factory.createWallet(owner);
    console.log(`[deploy-wallet] Sent: ${tx.hash}`);
    await tx.wait();

    const walletAddress = await factory.walletOf(owner);
    console.log(
      `[deploy-wallet] ✅ Deployed wallet for ${owner}: ${walletAddress}`
    );
    res.status(200).json({ success: true, walletAddress });
  } catch (err) {
    handleTransactionError(err, res);
  }
};
