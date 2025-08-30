const { expect } = require("chai");
const { ethers } = require("hardhat");
const { buildMerkleTree } = require("../scripts/utils/buildMerkleTree");

describe("Gas Consumption Comparison: Mapping vs. Bitmap", function () {
  let nft, owner, addr1, addr2;
  let proofs;

  beforeEach(async function () {
    [owner, addr1, addr2, _] = await ethers.getSigners();

    const whitelist = [owner.address, addr1.address, addr2.address];
    const { root, proofs: generatedProofs } = buildMerkleTree(whitelist);
    proofs = generatedProofs;

    const AdvancedNFT = await ethers.getContractFactory("AdvancedNFT");
    nft = await AdvancedNFT.deploy(
      root,
      [owner.address],
      [100] // Dummy contributors for the constructor
    );
    await nft.waitForDeployment();

    await nft.setSaleState(1); // Set to Presale
  });

  async function mintWithProof(minter, index, proof) {
    const secret = ethers.randomBytes(32);
    const commitHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(["bytes32"], [secret])
    );

    await nft.connect(minter).commitPresale(commitHash);

    const revealDelay = await nft.REVEAL_DELAY();
    for (let i = 0; i < Number(revealDelay); i++) {
      await ethers.provider.send("evm_mine");
    }

    const tx = await nft.connect(minter).revealPresale(index, secret, proof);
    const receipt = await tx.wait();
    return receipt.gasUsed;
  }

  it("should measure gas for minting with mapping", async function () {
    await nft.setUseBitmap(false); // Use mapping

    const gasUsed1 = await mintWithProof(addr1, 1, proofs[addr1.address]);
    const gasUsed2 = await mintWithProof(addr2, 2, proofs[addr2.address]);

    console.log(`\tGas used (mapping) - First mint: ${gasUsed1.toString()}`);
    console.log(`\tGas used (mapping) - Second mint: ${gasUsed2.toString()}`);

    expect(gasUsed1).to.be.gt(0);
  });

  it("should measure gas for minting with bitmap", async function () {
    await nft.setUseBitmap(true); // Use bitmap

    const gasUsed1 = await mintWithProof(addr1, 1, proofs[addr1.address]);
    const gasUsed2 = await mintWithProof(addr2, 2, proofs[addr2.address]);

    console.log(`\tGas used (bitmap) - First mint: ${gasUsed1.toString()}`);
    console.log(`\tGas used (bitmap) - Second mint: ${gasUsed2.toString()}`);

    expect(gasUsed1).to.be.gt(0);
  });
});
