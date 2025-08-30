const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  if (!process.env.USER_PRIVATE_KEY) {
    throw new Error(
      "USER_PRIVATE_KEY is not set in the .env file. Please set it to run this script."
    );
  }

  const [deployer] = await hre.ethers.getSigners();
  // Create a wallet instance for our test user
  const user = new hre.ethers.Wallet(
    process.env.USER_PRIVATE_KEY,
    hre.ethers.provider
  );

  const { nft: nftAddress } = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "deployed-addresses.json"))
  );

  console.log(`Interacting with NFT contract at: ${nftAddress}`);
  const nft = await hre.ethers.getContractAt("AdvancedNFT", nftAddress);
  const mintPrice = await nft.MINT_PRICE();

  //  Step 1: Owner sets the sale state to PublicSale
  console.log("Owner setting sale state to PublicSale (2)...");
  await (await nft.connect(deployer).setSaleState(2)).wait();
  console.log("✅ Sale state is now PublicSale.");

  //  Step 2: PUBLIC COMMIT + REVEAL (with detailed logs)

  console.log("\n--- Generating secret & commit hash ---");
  const secret = hre.ethers.hexlify(hre.ethers.randomBytes(32));
  console.log("Secret (bytes32 hex):", secret);

  const commitHash = hre.ethers.keccak256(
    hre.ethers.AbiCoder.defaultAbiCoder().encode(["bytes32"], [secret])
  );
  console.log("Commit hash (keccak256(abi.encode(secret))):", commitHash);

  // (optional) persist secret so you can recover a stuck commit later
  const secretsPath = path.join(
    __dirname,
    "..",
    `commit-secret-${user.address}.txt`
  );
  fs.appendFileSync(secretsPath, `${secret}\n`);
  console.log(`Saved secret to ${secretsPath}`);

  console.log("\n--- Sending commitPublic ---");
  console.log(
    `Paying exact mint price: ${hre.ethers.formatEther(mintPrice)} ETH`
  );
  const commitTx = await nft
    .connect(user)
    .commitPublic(commitHash, { value: mintPrice });
  console.log("Commit tx hash:", commitTx.hash);
  const commitRcpt = await commitTx.wait();
  console.log("Commit mined in block:", commitRcpt.blockNumber);

  let earliest, expires;
  try {
    console.log("\n--- Reading commit timing via getPublicCommit() ---");
    const c = await nft.getPublicCommit(user.address);
    const [
      hash,
      blockNumber,
      earliestRevealBlock,
      expiryBlock,
      expired,
      escrow,
    ] = c;
    console.log("On-chain commit hash:     ", hash);
    console.log("Commit block:             ", Number(blockNumber));
    console.log("Earliest reveal block:    ", Number(earliestRevealBlock));
    console.log("Expiry block:             ", Number(expiryBlock));
    console.log("Expired?:                 ", Boolean(expired));
    console.log("Escrowed (wei):           ", String(escrow));

    earliest = Number(earliestRevealBlock);
    expires = Number(expiryBlock);
  } catch (e) {
    console.log(
      "\ngetPublicCommit() not available on this contract, falling back…"
    );
    const delay = Number(await nft.REVEAL_DELAY());
    const commitBlock = commitRcpt.blockNumber;
    earliest = commitBlock + delay;
    expires = earliest + 7200; // must match contract default
    console.log("REVEAL_DELAY:             ", delay);
    console.log("Commit block:             ", commitBlock);
    console.log("Computed earliest reveal: ", earliest);
    console.log("Computed expiry block:    ", expires);
  }

  const now = await hre.ethers.provider.getBlockNumber();
  console.log("\nCurrent block:", now);

  if (now < earliest) {
    const waitBlocks = earliest - now;
    console.log(
      `Too early to reveal. Need to wait ${waitBlocks} more block(s).`
    );
    if (hre.network.name === "hardhat" || hre.network.name === "localhost") {
      console.log(`Mining ${waitBlocks} block(s) locally…`);
      await hre.network.provider.send("hardhat_mine", [
        "0x" + waitBlocks.toString(16),
      ]);
    } else {
      console.log(`Waiting on live network for ~${waitBlocks} block(s)…`);
      await waitFor(waitBlocks); //  helper that waits for blocks
    }
  } else if (now > expires) {
    console.warn(`Commit already expired at block ${expires}.`);
    console.log("Attempting to cancel & refund via cancelPublicCommit()…");
    const cancel = await nft.connect(user).cancelPublicCommit();
    console.log("Cancel tx hash:", cancel.hash);
    await cancel.wait();
    console.log("✅ Commit cancelled and escrow refunded.");
    return;
  } else {
    console.log(
      `Within reveal window: earliest=${earliest}, expires=${expires}. Proceeding…`
    );
  }

  console.log("\n--- Revealing ---");
  // UPDATE: Use the new `mintFor` function, as `revealPublic` has been removed.
  const revealTx = await nft.connect(user).mintFor(user.address, secret);
  console.log("Reveal tx hash:", revealTx.hash);
  const revealRcpt = await revealTx.wait();
  console.log("✅ Reveal mined in block:", revealRcpt.blockNumber);

  //  Step 3: Parse logs to find the new token ID and verify ownership
  const mintEvents = revealRcpt.logs
    .map((log) => {
      try {
        return nft.interface.parseLog(log);
      } catch (e) {
        return null;
      }
    })
    .filter((log) => log && log.name === "Minted");

  if (mintEvents.length > 0) {
    const tokenId = mintEvents[0].args.tokenId;
    console.log(`🆕 Minted tokenId: ${tokenId.toString()}`);

    const ownerOfToken = await nft.ownerOf(tokenId);
    const totalMinted = await nft.totalMinted();

    console.log("\n--- Mint Verification ---");
    console.log(`   - Token ID Minted: ${tokenId}`);
    console.log(`   - Owner of Token ${tokenId}: ${ownerOfToken}`);
    console.log(`   - Current Total Supply: ${totalMinted}`);
    console.log("-----------------------");

    if (ownerOfToken === user.address) {
      console.log("✅ Ownership verified successfully.");
    } else {
      console.error("❌ Ownership verification FAILED.");
    }
  } else {
    console.warn("Could not find Minted event in transaction logs.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
