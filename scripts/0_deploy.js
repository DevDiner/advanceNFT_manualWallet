const hre = require("hardhat");
require("dotenv").config();
const { buildMerkleTree } = require("./utils/buildMerkleTree");
const fs = require("fs");
const path = require("path");

/**
 * Safely adds or updates a key-value pair in a .env file.
 */
function upsertEnvVar(filePath, key, value) {
  const line = `${key}=${value}`;
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, line + "\n", "utf8");
    return;
  }
  const src = fs.readFileSync(filePath, "utf8");
  const lines = src.split(/\r?\n/);

  let found = false;
  const updated = lines.map((l) => {
    if (!l.trim().startsWith("#") && l.split("=")[0].trim() === key) {
      found = true;
      return line;
    }
    return l;
  });

  if (!found) updated.push(line);
  const out = updated.join("\n").replace(/\n*$/, "\n");
  fs.writeFileSync(filePath, out, "utf8");
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  // --- Signer Configuration (Robust for any network) ---
  const signers = await hre.ethers.getSigners();
  const deployer = signers[0];
  if (!deployer) {
    throw new Error(
      "Deployment account not found. Please check your Hardhat configuration and .env file."
    );
  }

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Network:", hre.network.name);

  const contributor1 = signers[1] || deployer;
  const contributor2 = signers[2] || deployer;

  console.log(`- Contributor 1: ${contributor1.address}`);
  console.log(`- Contributor 2: ${contributor2.address}`);

  let user;
  if (process.env.USER_PRIVATE_KEY) {
    user = new hre.ethers.Wallet(
      process.env.USER_PRIVATE_KEY,
      hre.ethers.provider
    );
    console.log("Test user configured with address:", user.address);
  } else {
    user = signers[3] || deployer;
    console.warn(
      `USER_PRIVATE_KEY not found in .env, using fallback: ${user.address}`
    );
  }

  // 1. Build Merkle Tree
  const whitelistAddresses = [deployer.address, user.address];
  const { root, claims } = buildMerkleTree(whitelistAddresses);

  const publicDir = path.join(__dirname, "..", "public");
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  const proofsPath = path.join(publicDir, "merkle-proofs.json");
  fs.writeFileSync(proofsPath, JSON.stringify({ root, claims }, null, 2));
  console.log(`Merkle proofs saved to ${proofsPath}`);
  console.log("Merkle Root:", root);

  // 2. Deploy AdvancedNFT
  const nftArgs = [
    root,
    [contributor1.address, contributor2.address],
    [60, 40],
  ];
  const AdvancedNFT = await hre.ethers.getContractFactory("AdvancedNFT");
  const nft = await AdvancedNFT.deploy(...nftArgs);
  await nft.waitForDeployment();
  const nftAddress = await nft.getAddress();
  console.log("✅ AdvancedNFT deployed to:", nftAddress);

  // 3. Deploy the SimpleWalletFactory
  const SimpleWalletFactory = await hre.ethers.getContractFactory(
    "SimpleWalletFactory"
  );
  const factory = await SimpleWalletFactory.deploy();
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("✅ SimpleWalletFactory deployed to:", factoryAddress);

  // 4. Save deployed addresses for backend scripts
  const deployedAddressesPath = path.join(
    __dirname,
    "..",
    "deployed-addresses.json"
  );
  fs.writeFileSync(
    deployedAddressesPath,
    JSON.stringify({ nft: nftAddress, factory: factoryAddress }, null, 2)
  );
  console.log(`✅ Deployed addresses saved to ${deployedAddressesPath}.`);

  // 5. Frontend Environment Configuration
  const envLocalPath = path.join(__dirname, "..", ".env.local");
  const networkName =
    hre.network.name === "localhost" ? "localhost" : "sepolia";
  try {
    upsertEnvVar(envLocalPath, "VITE_NETWORK", networkName);
    upsertEnvVar(envLocalPath, "VITE_NFT_ADDRESS", nftAddress);
    upsertEnvVar(envLocalPath, "VITE_FACTORY_ADDRESS", factoryAddress);

    // Auto-populate the relayer URL based on the network
    if (networkName === "localhost") {
      upsertEnvVar(envLocalPath, "VITE_RELAYER_URL", "http://localhost:3001");
    } else {
      // sepolia
      // For Sepolia, the relayer must be hosted publicly. Its URL is read from the main .env file.
      const relayerUrl = process.env.RELAYER_URL_SEPOLIA;
      if (relayerUrl) {
        upsertEnvVar(envLocalPath, "VITE_RELAYER_URL", relayerUrl);
      } else {
        console.warn(
          "\n🚨 WARNING: `RELAYER_URL_SEPOLIA` not found in `.env`."
        );
        console.warn(
          "   Gasless transactions on the frontend will fail on Sepolia."
        );
        console.warn(
          "   To fix this, deploy the relayer to a public service and add its URL to your .env file.\n"
        );
      }

      // Copy other public variables for Sepolia
      const publicVars = ["SEPOLIA_RPC_URL", "ETHERSCAN_API_KEY"];
      for (const key of publicVars) {
        if (process.env[key]) {
          upsertEnvVar(envLocalPath, `VITE_${key}`, process.env[key]);
        }
      }
    }

    console.log(
      `✅ Updated frontend environment in ${envLocalPath} for network: ${networkName}`
    );
  } catch (e) {
    console.warn(`Could not update ${envLocalPath}:`, e);
  }

  // Etherscan Verification
  if (hre.network.name === "sepolia" && process.env.ETHERSCAN_API_KEY) {
    console.log("\nWaiting 30 seconds for Etherscan to index the contracts...");
    await delay(30000);

    console.log("Verifying AdvancedNFT on Etherscan...");
    try {
      await hre.run("verify:verify", {
        address: nftAddress,
        constructorArguments: nftArgs,
      });
      console.log("✅ AdvancedNFT verified successfully.");
    } catch (e) {
      console.error("Verification failed for AdvancedNFT:", e.message);
    }

    console.log("\nVerifying SimpleWalletFactory on Etherscan...");
    try {
      await hre.run("verify:verify", {
        address: factoryAddress,
        constructorArguments: [],
      });
      console.log("✅ SimpleWalletFactory verified successfully.");
    } catch (e) {
      console.error("Verification failed for SimpleWalletFactory:", e.message);
    }
  }

  console.log("\nDeployment complete!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
