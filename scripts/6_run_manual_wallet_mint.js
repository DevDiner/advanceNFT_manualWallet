// SCRIPT 6: MINTING WITH THE MANUAL WALLET
// ==========================================
// This script is the ultimate demonstration of the `wallet.js` utility.
// It connects the low-level, from-scratch wallet to the high-level, feature-rich
// `AdvancedNFT` smart contract.
//
// The flow is:
// 1. Manually ABI-encode the `commitPublic` function call into raw calldata.
// 2. Use the `ManualWallet` to sign and broadcast this raw transaction.
// 3. Wait for the reveal delay.
// 4. Manually ABI-encode the `mintFor` function call.
// 5. Use the `ManualWallet` again to sign and broadcast the final mint transaction.
//
// This proves that the manual wallet implementation can handle complex, multi-step
// interactions with a live smart contract.

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const { ManualWallet } = require("./utils/wallet.js");

async function main() {
  if (!process.env.USER_PRIVATE_KEY) {
    throw new Error(
      "USER_PRIVATE_KEY is not set in the .env file. This script requires a dedicated private key to run."
    );
  }

  const [deployer] = await hre.ethers.getSigners();
  const { nft: nftAddress } = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "deployed-addresses.json"))
  );

  console.log("--- Minting with the From-Scratch Manual Wallet ---");
  console.log(`Interacting with NFT contract at: ${nftAddress}`);

  // Get the contract interface (ABI) to encode function calls
  const nft = await hre.ethers.getContractAt("AdvancedNFT", nftAddress);
  const mintPrice = await nft.MINT_PRICE();

  // Initialize our manual wallet
  const chainId = (await hre.ethers.provider.getNetwork()).chainId;
  const manualWallet = new ManualWallet(
    process.env.USER_PRIVATE_KEY,
    hre.network.config.url, // Use the RPC URL from hardhat config
    chainId
  );
  console.log(`Manual wallet initialized for user: ${manualWallet.address}`);

  // Ensure the user wallet has funds
  await (
    await deployer.sendTransaction({
      to: manualWallet.address,
      value: hre.ethers.parseEther("1.0"),
    })
  ).wait();

  // --- Step 1: Set Sale State ---
  console.log("\nOwner setting sale state to PublicSale (2)...");
  await (await nft.connect(deployer).setSaleState(2)).wait();
  console.log("✅ Sale state is now PublicSale.");

  // --- Step 2: Manually prepare and send the COMMIT transaction ---
  const secret = hre.ethers.randomBytes(32);
  const commitHash = hre.ethers.keccak256(
    hre.ethers.AbiCoder.defaultAbiCoder().encode(["bytes32"], [secret])
  );

  console.log(
    `\nManually encoding 'commitPublic' call with hash: ${commitHash}`
  );
  const commitCalldata = nft.interface.encodeFunctionData("commitPublic", [
    commitHash,
  ]);

  console.log("Using ManualWallet to send the COMMIT transaction...");
  const commitReceipt = await manualWallet.buildAndSendTx(
    nftAddress,
    mintPrice,
    commitCalldata
  );
  console.log(
    `✅ Commit transaction sent and confirmed in block ${commitReceipt.blockNumber}`
  );

  // --- Step 3: Wait for reveal delay ---
  const revealDelay = await nft.REVEAL_DELAY();
  console.log(`\nWaiting for ${revealDelay} blocks before revealing...`);
  for (let i = 0; i < Number(revealDelay); i++) {
    await hre.network.provider.send("evm_mine");
  }
  console.log("✅ Reveal delay has passed.");

  // --- Step 4: Manually prepare and send the REVEAL transaction ---
  console.log(`\nManually encoding 'mintFor' call...`);
  // UPDATE: Use the new `mintFor` function, as `revealPublic` has been removed.
  const revealCalldata = nft.interface.encodeFunctionData("mintFor", [
    manualWallet.address,
    secret,
  ]);

  console.log("Using ManualWallet to send the REVEAL transaction...");
  await manualWallet.buildAndSendTx(nftAddress, 0n, revealCalldata);
  console.log(`✅ Reveal transaction sent and confirmed!`);

  // --- Step 5: Verify the mint ---
  const balance = await nft.balanceOf(manualWallet.address);
  console.log(`\nUser's final NFT balance is: ${balance.toString()}`);

  if (balance > 0) {
    console.log("✅ Minting with the manual wallet was successful!");
  } else {
    console.error("❌ Minting with the manual wallet FAILED.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
