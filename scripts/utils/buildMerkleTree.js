const { MerkleTree } = require("merkletreejs");
const { ethers } = require("ethers");

function buildMerkleTree(addresses) {
  // FIX: The leaf must be keccak256(abi.encodePacked(index, address)) to match
  // the smart contract's verification logic. Hashing only the address is incorrect.
  const leaves = addresses.map((addr, index) =>
    ethers.solidityPackedKeccak256(["uint256", "address"], [index, addr])
  );

  const tree = new MerkleTree(leaves, ethers.keccak256, { sortPairs: true });

  const root = tree.getHexRoot();

  // FIX: Generate a more robust claims object that includes the index for each user.
  // This prevents fragile index lookups on the frontend and in scripts.
  const claims = {};
  addresses.forEach((address, index) => {
    const proof = tree.getHexProof(leaves[index]);
    claims[address] = { index, proof };
  });

  // The root and the claims object are saved. `proofs` is renamed to `claims` for clarity.
  return { root, claims };
}

module.exports = { buildMerkleTree };
