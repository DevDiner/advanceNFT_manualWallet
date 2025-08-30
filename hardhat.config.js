require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();
const fs = require("fs");
const path = require("path");

// Define a new Hardhat task to set the sale state.
// This is the idiomatic way to handle command-line arguments in Hardhat.
task("set-sale-state", "Sets the sale state of the NFT contract")
  .addPositionalParam(
    "state",
    "The desired sale state (closed, presale, public)"
  )
  .setAction(async (taskArgs, hre) => {
    const stateArg = taskArgs.state.toLowerCase();
    const stateMap = {
      closed: 0,
      presale: 1,
      airdrop: 1,
      public: 2,
      publicsale: 2,
    };

    const newState = stateMap[stateArg];
    if (newState === undefined) {
      console.error(
        `❌ Error: Invalid state argument '${stateArg}'. Please use 'closed', 'presale', or 'public'.`
      );
      process.exit(1);
    }
    const stateName = Object.keys(stateMap).find(
      (key) => stateMap[key] === newState
    );

    const { nft: nftAddress } = JSON.parse(
      fs.readFileSync(path.join(__dirname, "deployed-addresses.json"))
    );
    if (!nftAddress) {
      throw new Error(
        "Could not find deployed NFT contract address in deployed-addresses.json"
      );
    }

    const [owner] = await hre.ethers.getSigners();
    const nft = await hre.ethers.getContractAt(
      "AdvancedNFT",
      nftAddress,
      owner
    );

    console.log(`\nSetting sale state on contract ${nftAddress}...`);
    console.log(`   - Network: ${hre.network.name}`);
    console.log(`   - Signer: ${owner.address}`);
    console.log(`   - New State: ${stateName.toUpperCase()} (${newState})`);

    try {
      const tx = await nft.setSaleState(newState);
      console.log(`   - Transaction sent: ${tx.hash}`);
      await tx.wait();
      console.log("\n✅ Sale state successfully updated!");
    } catch (e) {
      console.error("\n❌ Error during transaction:", e.message);
      process.exit(1);
    }
  });

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  networks: {
    hardhat: {
      chainId: 1337, // Standard for local development
    },
    localhost: {
      chainId: 1337,
      url: "http://127.0.0.1:8545",
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};
