// scripts/1_run_airdrop_simulation.js
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// ----------------- helpers -----------------
async function waitForBlocks(provider, n) {
  const start = await provider.getBlockNumber();
  const target = start + n;
  while (true) {
    const now = await provider.getBlockNumber();
    if (now >= target) break;
    await new Promise((r) => setTimeout(r, 12_000)); // ~Sepolia block time
  }
}

async function mineBlocks(n) {
  try {
    const hex = "0x" + n.toString(16);
    await hre.network.provider.send("hardhat_mine", [hex]);
  } catch {
    for (let i = 0; i < n; i++) {
      await hre.network.provider.send("evm_mine", []);
    }
  }
}

function secretFilePath(address) {
  return path.join(__dirname, "..", `commit-secret-${address}.txt`);
}
function saveSecret(address, secret) {
  const p = secretFilePath(address);
  fs.appendFileSync(p, `${secret}\n`, "utf8");
  console.log(`Saved secret to ${p}`);
}
function loadAllSavedSecrets(address) {
  const p = secretFilePath(address);
  if (!fs.existsSync(p)) return [];
  return fs
    .readFileSync(p, "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

async function pickSigners() {
  const signers = await hre.ethers.getSigners();
  const owner = signers[0];
  if (!owner) throw new Error("No signer configured. Set PRIVATE_KEY in env.");

  let user;
  if (process.env.USER_PRIVATE_KEY) {
    user = new hre.ethers.Wallet(
      process.env.USER_PRIVATE_KEY,
      hre.ethers.provider
    );
    console.log("Using USER_PRIVATE_KEY as user:", await user.getAddress());
  } else if (signers[1]) {
    user = signers[1];
    console.log(
      "Using second configured signer as user:",
      await user.getAddress()
    );
  } else {
    user = owner;
    console.warn("No USER_PRIVATE_KEY or second signer; using owner as user.");
  }
  return { owner, user };
}

// -------- proofs --------
function loadProofForUser(userAddr) {
  const proofsJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "merkle-proofs.json"), "utf8")
  );
  const proofsMap = proofsJson.proofs;
  if (!proofsMap || typeof proofsMap !== "object") {
    throw new Error("Unexpected proofs shape in merkle-proofs.json");
  }
  const want = userAddr.toLowerCase();
  let proof = proofsMap[userAddr] || proofsMap[userAddr.toLowerCase()];
  if (!proof) {
    for (const [addr, prf] of Object.entries(proofsMap)) {
      if (addr.toLowerCase() === want) {
        proof = prf;
        break;
      }
    }
  }
  if (!proof) throw new Error(`No merkle proof found for ${userAddr}`);

  const keysInOrder = Object.keys(proofsMap);
  let index = keysInOrder.findIndex((k) => k.toLowerCase() === want);
  if (index === -1) index = 0; // fallback
  return { index, proof };
}

async function getRevealDelayOrDefault(NFT, def = 10) {
  try {
    return Number(await NFT.REVEAL_DELAY());
  } catch {
    return def;
  }
}

// ------------- commit hash formulas -------------
const coder = () => hre.ethers.AbiCoder.defaultAbiCoder();
function H_secret(secret) {
  return hre.ethers.keccak256(coder().encode(["bytes32"], [secret]));
}
function H_idx_secret_packed(index, secret) {
  return hre.ethers.solidityPackedKeccak256(
    ["uint256", "bytes32"],
    [index, secret]
  );
}
function H_addr_secret(addr, secret) {
  return hre.ethers.keccak256(
    coder().encode(["address", "bytes32"], [addr, secret])
  );
}
function H_addr_secret_packed(addr, secret) {
  return hre.ethers.solidityPackedKeccak256(
    ["address", "bytes32"],
    [addr, secret]
  );
}

// ----------------- main -----------------

async function main() {
  const { owner, user } = await pickSigners();
  const userAddr = await user.getAddress();
  const { index, proof } = loadProofForUser(userAddr);

  const { nft: nftAddress } = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "deployed-addresses.json"))
  );

  const NFT = await hre.ethers.getContractAt("AdvancedNFT", nftAddress, owner);
  const userNFT = NFT.connect(user);

  async function checkExistingCommit() {
    console.log("\nChecking for existing airdrop commit for user...");
    const _exists = (c) => c.hash !== hre.ethers.ZeroHash;
    try {
      const c = await NFT.getAirdropCommit(userAddr);
      if (_exists(c)) {
        console.log("Found existing commit:", c);
        const { commitBlock, earliestRevealBlock, expiryBlock, expired } = c;
        return {
          exists: true,
          commitBlock: Number(commitBlock),
          earliest: Number(earliestRevealBlock),
          expires: Number(expiryBlock),
          isExpired: Boolean(expired),
        };
      }
    } catch (e) {
      console.warn(
        "getAirdropCommit() failed, falling back to direct mapping read...",
        e.message
      );
      const c = await NFT.airdropCommits(userAddr);
      if (_exists(c)) {
        const commitBlock = Number(c.blockNumber);
        const delay = await getRevealDelayOrDefault(NFT);
        const window = 7200; // must match contract
        const earliest = commitBlock + delay;
        const expires = earliest + window;
        const now = await hre.ethers.provider.getBlockNumber();
        const isExpired = now > expires;
        return {
          exists: true,
          commitBlock,
          earliest,
          expires,
          isExpired,
        };
      }
    }
    return { exists: false };
  }

  // Set to Presale state.
  console.log("Owner setting sale state to Presale (1)...");
  await (await NFT.setSaleState(1)).wait();

  const { exists, earliest, expires, isExpired } = await checkExistingCommit();
  let secret;

  if (exists) {
    console.log(
      "User already has a commit. Will try to reveal with saved secrets."
    );
    const savedSecrets = loadAllSavedSecrets(userAddr);
    if (savedSecrets.length === 0) {
      console.error(
        `No saved secrets for ${userAddr}. Cannot reveal. Please cancel or wait for expiry.`
      );
      return;
    }
    secret = savedSecrets[savedSecrets.length - 1]; // try last one
  } else {
    // Commit new secret.
    secret = hre.ethers.randomBytes(32);
    const commitHash = H_secret(secret);
    console.log("\nUser sending new airdrop commit...");
    console.log("Secret:", hre.ethers.hexlify(secret));
    console.log("Commit hash:", commitHash);
    const tx = await userNFT.commitAirdrop(commitHash);
    const rcpt = await tx.wait();
    console.log("Commit tx mined in block", rcpt.blockNumber);
    saveSecret(userAddr, hre.ethers.hexlify(secret));
  }

  const now = await hre.ethers.provider.getBlockNumber();
  const currentEarliest = exists
    ? earliest
    : now + (await getRevealDelayOrDefault(NFT));

  if (now < currentEarliest) {
    const waitBlocks = currentEarliest - now;
    console.log(`Waiting for ${waitBlocks} blocks until earliest reveal...`);
    await mineBlocks(waitBlocks);
  }

  console.log("\nUser revealing airdrop...");
  await (await userNFT.revealAirdrop(index, secret, proof)).wait();
  console.log("✅ Reveal transaction successful!");

  const bal = await NFT.balanceOf(userAddr);
  console.log(`User NFT balance: ${bal.toString()}`);
  if (bal > 0n) {
    console.log("✅ Airdrop mint successful!");
  } else {
    console.error("❌ Airdrop mint FAILED.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
