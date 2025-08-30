// SCRIPT 7: SET SALE STATE UTILITY
// ================================
// This is a simple utility script for developers to quickly change the sale
// state of the deployed NFT contract. It allows for easy manual testing of
// the frontend dApp's different states (Closed, Airdrop, Public Sale).

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  // 1. Get the desired state from the command-line arguments.
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error("❌ Error: Please provide a sale state as an argument.");
    console.error(
      "   Usage: npx hardhat run <script> --network <net> [closed|presale|public]"
    );
    process.exit(1);
  }
  const stateArg = args[0].toLowerCase();

  // 2. Map the string argument to the contract's SaleState enum value.
  const stateMap = {
    closed: 0,
    presale: 1,
    airdrop: 1, // Alias for presale
    public: 2,
    publicsale: 2, // Alias for public
  };

  const newState = stateMap[stateArg];
  if (newState === undefined) {
    console.error(`❌ Error: Invalid state argument '${stateArg}'.`);
    console.error("   Please use 'closed', 'presale', or 'public'.");
    process.exit(1);
  }
  // Find the canonical name for logging purposes
  const stateName = stateArg
    .replace("publicsale", "public")
    .replace("presale", "airdrop");

  // 3. Connect to the deployed contract.
  const { nft: nftAddress } = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "deployed-addresses.json"))
  );
  if (!nftAddress) {
    throw new Error(
      "Could not find deployed NFT contract address in deployed-addresses.json"
    );
  }

  const [owner] = await hre.ethers.getSigners();
  const nft = await hre.ethers.getContractAt("AdvancedNFT", nftAddress, owner);

  console.log(`\nSetting sale state on contract ${nftAddress}...`);
  console.log(`   - Network: ${hre.network.name}`);
  console.log(`   - Signer: ${owner.address}`);
  console.log(`   - New State: ${stateName.toUpperCase()} (${newState})`);

  // 4. Call the setSaleState function and wait for confirmation.
  try {
    const tx = await nft.setSaleState(newState);
    console.log(`   - Transaction sent: ${tx.hash}`);
    await tx.wait();
    console.log("\n✅ Sale state successfully updated!");
  } catch (e) {
    console.error("\n❌ Error during transaction:", e.message);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
