// SCRIPT 4: META-TRANSACTION MINT SIMULATION
// ==========================================
// This script is a self-contained simulation to demonstrate that the `SimpleWallet.sol`
// contract's EIP-712 meta-transaction logic is working correctly. It simulates the
// full gasless minting flow for the public sale.
//
// 1. The "User" (owner): Signs the transaction data off-chain.
// 2. The "Relayer": Takes the signed data and submits it to the blockchain, paying the gas.

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  // In this simulation, we use the default Hardhat signers for clarity.
  // `owner` is the user who wants to perform a gasless transaction.
  // `relayer` is the account that will pay the gas.
  const [owner, relayer] = await hre.ethers.getSigners();
  const { factory: factoryAddress, nft: nftAddress } = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "deployed-addresses.json"))
  );

  console.log("--- Meta-Transaction Mint Simulation ---");
  console.log(`User (signs meta-tx): ${owner.address}`);
  console.log(`Relayer (pays gas):   ${relayer.address}`);
  console.log(`Wallet Factory:       ${factoryAddress}`);
  console.log(`NFT Contract:         ${nftAddress}`);

  // --- Step 1: Ensure user has a smart wallet ---
  const factory = await hre.ethers.getContractAt(
    "SimpleWalletFactory",
    factoryAddress
  );
  let smartWalletAddress = await factory.walletOf(owner.address);

  if (smartWalletAddress === hre.ethers.ZeroAddress) {
    console.log("\nUser does not have a smart wallet. Creating one...");
    await (await factory.connect(relayer).createWallet(owner.address)).wait();
    smartWalletAddress = await factory.walletOf(owner.address);
    console.log(`✅ Smart wallet created for user at: ${smartWalletAddress}`);
  } else {
    console.log(`\nUser already has a smart wallet at: ${smartWalletAddress}`);
  }

  const smartWallet = await hre.ethers.getContractAt(
    "SimpleWallet",
    smartWalletAddress
  );
  const nft = await hre.ethers.getContractAt("AdvancedNFT", nftAddress);
  const mintPrice = await nft.MINT_PRICE();

  // The SimpleWallet needs to hold the funds to pay the mint price.
  await (
    await owner.sendTransaction({ to: smartWalletAddress, value: mintPrice })
  ).wait();
  console.log(
    `\nFunded Smart Wallet with ${hre.ethers.formatEther(
      mintPrice
    )} ETH from the user for the mint price.`
  );

  // --- Step 2: Set sale state and perform commit-reveal via meta-tx ---
  await (await nft.connect(owner).setSaleState(2)).wait(); // 2 = PublicSale
  console.log("\nSale state set to PublicSale.");

  const secret = hre.ethers.randomBytes(32);
  // FIX: Corrected a critical typo from keccak26 to keccak256.
  const commitHash = hre.ethers.keccak256(
    hre.ethers.AbiCoder.defaultAbiCoder().encode(["bytes32"], [secret])
  );

  // --- COMMIT META-TRANSACTION ---
  console.log("\n--- Signing COMMIT Meta-Transaction ---");
  const commitCalldata = nft.interface.encodeFunctionData("commitPublic", [
    commitHash,
  ]);
  const commitNonce = await smartWallet.nonces(owner.address);

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
    from: owner.address,
    nonce: commitNonce,
    to: nftAddress,
    value: mintPrice,
    data: commitCalldata,
  };
  const commitSignature = await owner.signTypedData(
    domain,
    types,
    commitMessage
  );

  console.log("Relayer submitting COMMIT transaction...");
  await (
    await smartWallet
      .connect(relayer)
      .executeMetaTransaction(
        owner.address,
        nftAddress,
        mintPrice,
        commitCalldata,
        commitSignature
      )
  ).wait();
  console.log("✅ COMMIT Meta-Transaction successful!");

  // --- Wait for reveal delay ---
  const revealDelay = await nft.REVEAL_DELAY();
  console.log(`\nWaiting for ${revealDelay} blocks...`);
  for (let i = 0; i < Number(revealDelay); i++) {
    await hre.network.provider.send("evm_mine");
  }

  // --- REVEAL META-TRANSACTION ---
  console.log("\n--- Signing REVEAL Meta-Transaction ---");
  const revealCalldata = nft.interface.encodeFunctionData("mintFor", [
    smartWalletAddress,
    secret,
  ]);
  const revealNonce = await smartWallet.nonces(owner.address);
  const revealMessage = {
    from: owner.address,
    nonce: revealNonce,
    to: nftAddress,
    value: 0,
    data: revealCalldata,
  };
  const revealSignature = await owner.signTypedData(
    domain,
    types,
    revealMessage
  );

  console.log("Relayer submitting REVEAL transaction...");
  await (
    await smartWallet
      .connect(relayer)
      .executeMetaTransaction(
        owner.address,
        nftAddress,
        0,
        revealCalldata,
        revealSignature
      )
  ).wait();
  console.log("✅ REVEAL Meta-Transaction successful!");

  // --- Step 3: Verify the mint ---
  const balance = await nft.balanceOf(smartWalletAddress);
  console.log(`\nSmart Wallet's final NFT balance is: ${balance.toString()}`);

  if (balance > 0) {
    console.log("\n✅ Gasless minting simulation was successful!");
  } else {
    console.error("\n❌ Gasless minting simulation FAILED.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
