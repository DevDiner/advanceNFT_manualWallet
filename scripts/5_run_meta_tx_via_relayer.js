// SCRIPT 5: META-TRANSACTION MINT VIA RELAYER
// ============================================
// This script demonstrates a realistic, production-style meta-transaction flow
// by performing a full gasless NFT mint via the running relayer server.
//
// The flow is:
// 1. A Smart Wallet is created for the user via the relayer, if one doesn't exist.
// 2. The Smart Wallet is funded with the NFT mint price.
// 3. The user signs the COMMIT data off-chain and sends it to the relayer.
// 4. The script waits for the reveal window.
// 5. The user signs the REVEAL data off-chain and sends it to the relayer.
// 6. The relayer server submits both transactions, paying the gas.
//
// TO RUN THIS:
// 1. In one terminal, start the relayer server: `npm run start:relayer`
// 2. In another terminal, run this script: `npx hardhat run scripts/5_run_meta_tx_via_relayer.js --network localhost`

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const axios = require("axios"); // For making HTTP requests

async function main() {
  if (!process.env.USER_PRIVATE_KEY) {
    throw new Error(
      "USER_PRIVATE_KEY is not set in the .env file. Please set it to run this script."
    );
  }

  const [owner] = await hre.ethers.getSigners();
  const user = new hre.ethers.Wallet(
    process.env.USER_PRIVATE_KEY,
    hre.ethers.provider
  );

  const { factory: factoryAddress, nft: nftAddress } = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "deployed-addresses.json"))
  );

  console.log("--- Gasless Mint via Relayer Server ---");
  console.log(`User (signs meta-tx): ${user.address}`);
  console.log(`NFT Contract:         ${nftAddress}`);

  const relayerUrl = "http://localhost:3000";
  const factory = await hre.ethers.getContractAt(
    "SimpleWalletFactory",
    factoryAddress
  );
  const nft = await hre.ethers.getContractAt("AdvancedNFT", nftAddress);
  const mintPrice = await nft.MINT_PRICE();
  let smartWalletAddress = await factory.walletOf(user.address);

  // --- Step 1: Ensure user has a smart wallet (create via relayer if needed) ---
  if (smartWalletAddress === hre.ethers.ZeroAddress) {
    console.log(
      "\nUser does not have a smart wallet. Requesting creation from relayer..."
    );
    try {
      const response = await axios.post(`${relayerUrl}/deploy-wallet`, {
        owner: user.address,
      });
      if (response.data.success) {
        smartWalletAddress = response.data.walletAddress;
        console.log(
          `✅ Relayer deployed smart wallet to: ${smartWalletAddress}`
        );
      } else {
        throw new Error(
          response.data.error || "Relayer failed to deploy wallet."
        );
      }
    } catch (e) {
      console.error("❌ Failed to create smart wallet via relayer:", e.message);
      return;
    }
  } else {
    console.log(`\nUser already has smart wallet: ${smartWalletAddress}`);
  }

  const smartWallet = await hre.ethers.getContractAt(
    "SimpleWallet",
    smartWalletAddress
  );

  // --- Step 2: Fund the wallet and set sale state ---
  await (
    await owner.sendTransaction({ to: smartWalletAddress, value: mintPrice })
  ).wait();
  console.log(
    `\nFunded Smart Wallet with ${hre.ethers.formatEther(
      mintPrice
    )} ETH for the mint price.`
  );
  await (await nft.connect(owner).setSaleState(2)).wait(); // 2 = PublicSale
  console.log("Sale state set to PublicSale.");

  const secret = hre.ethers.randomBytes(32);
  const commitHash = hre.ethers.keccak256(
    hre.ethers.AbiCoder.defaultAbiCoder().encode(["bytes32"], [secret])
  );

  // --- Step 3: User signs COMMIT and sends to relayer ---
  const commitNonce = await smartWallet.nonces(user.address);
  const commitCalldata = nft.interface.encodeFunctionData("commitPublic", [
    commitHash,
  ]);

  const domain = {
    name: "SimpleWallet",
    version: "1",
    chainId: (await hre.ethers.provider.getNetwork()).chainId,
    verifyingContract: smartWalletAddress,
  };
  const types = {
    MetaTransaction: [
      { name: "from", type: "address" },
      { name: "nonce", type: "uint256" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "data", type: "bytes" },
    ],
  };

  const commitMessage = {
    from: user.address,
    to: nftAddress,
    value: mintPrice.toString(),
    nonce: commitNonce.toString(),
    data: commitCalldata,
  };
  const commitSignature = await user.signTypedData(
    domain,
    types,
    commitMessage
  );

  console.log("\nSending COMMIT to relayer...");
  try {
    const response = await axios.post(`${relayerUrl}/relay`, {
      ...commitMessage,
      signature: commitSignature,
      smartWalletAddress,
    });
    console.log("✅ Relayer accepted COMMIT. Waiting for confirmation...");
    await hre.ethers.provider.waitForTransaction(
      response.data.txHash,
      1,
      15000
    );
  } catch (e) {
    console.error(
      "❌ Error sending COMMIT to relayer:",
      e.response ? e.response.data : e.message
    );
    return;
  }

  // --- Step 4: Wait for reveal delay ---
  const revealDelay = await nft.REVEAL_DELAY();
  console.log(`\nWaiting for ${revealDelay} blocks...`);
  for (let i = 0; i < Number(revealDelay); i++) {
    await hre.network.provider.send("evm_mine");
  }

  // --- Step 5: User signs REVEAL and sends to relayer ---
  const revealNonce = await smartWallet.nonces(user.address);
  const revealCalldata = nft.interface.encodeFunctionData("mintFor", [
    smartWalletAddress,
    secret,
  ]);
  const revealMessage = {
    from: user.address,
    to: nftAddress,
    value: "0",
    nonce: revealNonce.toString(),
    data: revealCalldata,
  };
  const revealSignature = await user.signTypedData(
    domain,
    types,
    revealMessage
  );

  console.log("\nSending REVEAL to relayer...");
  try {
    const response = await axios.post(`${relayerUrl}/relay`, {
      ...revealMessage,
      signature: revealSignature,
      smartWalletAddress,
    });
    console.log("✅ Relayer accepted REVEAL. Waiting for confirmation...");
    await hre.ethers.provider.waitForTransaction(
      response.data.txHash,
      1,
      15000
    );
  } catch (e) {
    console.error(
      "❌ Error sending REVEAL to relayer:",
      e.response ? e.response.data : e.message
    );
    return;
  }

  // --- Step 6: Verify the mint ---
  const balance = await nft.balanceOf(smartWalletAddress);
  console.log(`\nSmart Wallet's final NFT balance is: ${balance.toString()}`);

  if (balance > 0) {
    console.log("\n✅ Gasless mint via relayer was successful!");
  } else {
    console.error("\n❌ Gasless mint via relayer FAILED.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
