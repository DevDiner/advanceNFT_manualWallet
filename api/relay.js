// api/relay.js
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
    const { simpleWalletAbi, relayerWallet } = await setup();
    const { from, to, value, data, signature, smartWalletAddress } = req.body;

    // Rigorous Input Validation
    if (!from || !ethers.isAddress(from))
      return res
        .status(400)
        .json({ error: "Valid 'from' address is required." });
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

    console.log(
      `\n[api/relay] Received request for smart wallet: ${smartWalletAddress}`
    );

    const simpleWalletContract = new ethers.Contract(
      smartWalletAddress,
      simpleWalletAbi,
      relayerWallet
    );
    const tx = await simpleWalletContract.executeMetaTransaction(
      from,
      to,
      ethers.toBigInt(value),
      data,
      signature
    );
    console.log(`[api/relay] Transaction sent by relayer. Hash: ${tx.hash}`);
    await tx.wait();
    console.log(
      `[api/relay] ✅ Meta-transaction successfully relayed and confirmed!`
    );
    res.status(200).json({ success: true, txHash: tx.hash });
  } catch (error) {
    handleTransactionError(error, res);
  }
};
