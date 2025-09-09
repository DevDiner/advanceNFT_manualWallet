// scripts/0_deploy.js
const hre = require("hardhat");
require("dotenv").config();
const { buildMerkleTree } = require("./utils/buildMerkleTree");
const fs = require("fs");
const path = require("path");

/** Safely adds or updates a key-value pair in a .env file. */
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
  //  Signers
  const signers = await hre.ethers.getSigners();
  const deployer = signers[0];
  if (!deployer) {
    throw new Error(
      "Deployment account not found. Check hardhat config and .env"
    );
  }

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Network:", hre.network.name);

  // Test user (for Merkle)
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

  //  Contributors (addresses don't need to be signers)
  const envC1 = process.env.CONTRIBUTOR1_ADDRESS;
  const envC2 = process.env.CONTRIBUTOR2_ADDRESS;

  // Fallbacks for local/dev if envs are missing
  const fallback1 = envC1 || deployer.address;
  const fallback2 = envC2 || signers[1]?.address || user.address;

  // Normalize / checksum
  const toChecksum = (a) => hre.ethers.getAddress(a);
  const rawPayees = [toChecksum(fallback1), toChecksum(fallback2)];

  // Shares (any positive integers; ratios matter)
  const s1 = Number(process.env.CONTRIBUTOR1_SHARES || 60);
  const s2 = Number(process.env.CONTRIBUTOR2_SHARES || 40);
  const rawShares = [s1, s2];

  // Merge duplicates so the contract never reverts on duplicate payees
  function mergePayeesAndShares(payees, shares) {
    const m = new Map();
    for (let i = 0; i < payees.length; i++) {
      const addr = payees[i];
      const sh = BigInt(shares[i]);
      if (sh <= 0n) throw new Error(`Invalid shares for ${addr}`);
      m.set(addr, (m.get(addr) ?? 0n) + sh);
    }
    return {
      payees: Array.from(m.keys()),
      shares: Array.from(m.values()).map((n) => Number(n)),
    };
  }
  const merged = mergePayeesAndShares(rawPayees, rawShares);

  console.log("Final contributors:", merged.payees);
  console.log("Final shares:", merged.shares);

  //  1) Build Merkle Tree
  const whitelistAddresses = [deployer.address, user.address];
  const { root, claims } = buildMerkleTree(whitelistAddresses);

  const publicDir = path.join(__dirname, "..", "public");
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
  const proofsPath = path.join(publicDir, "merkle-proofs.json");
  fs.writeFileSync(proofsPath, JSON.stringify({ root, claims }, null, 2));
  console.log(`Merkle proofs saved to ${proofsPath}`);
  console.log("Merkle Root:", root);

  //  2) Deploy AdvancedNFT
  const nftArgs = [root, merged.payees, merged.shares];
  const AdvancedNFT = await hre.ethers.getContractFactory("AdvancedNFT");
  const nft = await AdvancedNFT.deploy(...nftArgs);
  await nft.waitForDeployment();
  const nftAddress = await nft.getAddress();
  console.log("✅ AdvancedNFT deployed to:", nftAddress);

  //  3) Deploy SimpleWalletFactory
  const SimpleWalletFactory = await hre.ethers.getContractFactory(
    "SimpleWalletFactory"
  );
  const factory = await SimpleWalletFactory.deploy();
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("✅ SimpleWalletFactory deployed to:", factoryAddress);

  //  4) Save deployed addresses for backend scripts
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

  //  4.5) Generate backend artifacts (JSON and JS Module)
  console.log("\nGenerating backend artifacts...");
  const factoryArtifact = await hre.artifacts.readArtifact(
    "SimpleWalletFactory"
  );
  const walletArtifact = await hre.artifacts.readArtifact("SimpleWallet");

  const artifacts = {
    factoryAbi: factoryArtifact.abi,
    walletAbi: walletArtifact.abi,
  };

  // relayer-artifacts.json (optional, useful for debugging)
  const jsonArtifactsPath = path.join(
    __dirname,
    "..",
    "relayer-artifacts.json"
  );
  fs.writeFileSync(
    jsonArtifactsPath,
    JSON.stringify(artifacts, null, 2),
    "utf8"
  );
  console.log(`✅ Raw JSON artifacts saved to ${jsonArtifactsPath}.`);

  // api/_ABI.js (used by Vercel serverless)
  const abiModuleContent = `
// api/_ABI.js
// THIS FILE IS AUTO-GENERATED BY scripts/0_deploy.js — DO NOT EDIT.
module.exports = {
  factoryAbi: ${JSON.stringify(artifacts.factoryAbi, null, 2)},
  walletAbi: ${JSON.stringify(artifacts.walletAbi, null, 2)},
};
`.trim();

  const abiModulePath = path.join(__dirname, "..", "api", "_ABI.js");
  fs.writeFileSync(abiModulePath, abiModuleContent, "utf8");
  console.log(`✅ API ABI module saved to ${abiModulePath}.`);

  //  5) Frontend Environment Configuration
  const envLocalPath = path.join(__dirname, "..", ".env.local");
  const networkName =
    hre.network.name === "localhost" ? "localhost" : "sepolia";
  try {
    upsertEnvVar(envLocalPath, "VITE_NETWORK", networkName);
    upsertEnvVar(envLocalPath, "VITE_NFT_ADDRESS", nftAddress);
    upsertEnvVar(envLocalPath, "VITE_FACTORY_ADDRESS", factoryAddress);

    if (networkName === "sepolia") {
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

  //  Etherscan Verification (optional)
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
