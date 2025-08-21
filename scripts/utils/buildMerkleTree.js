const { MerkleTree } = require("merkletreejs");
const { keccak256 } = require("js-sha3");
const { ethers } = require("ethers");

// This function now correctly builds the tree based on (index, address)
function buildMerkleTree(addresses) {
    console.log("Building Merkle tree for whitelisted addresses...");

    const leaves = addresses.map((address, index) => {
        const packed = ethers.solidityPacked(["uint256", "address"], [index, address]);
        return Buffer.from(ethers.toBeArray(ethers.keccak256(packed)));
    });

    const tree = new MerkleTree(leaves, (el) => Buffer.from(keccak256(el), 'hex'), { sortPairs: true });
    
    const root = tree.getHexRoot();

    const proofs = {};
    addresses.forEach((address, index) => {
        proofs[address] = tree.getHexProof(leaves[index]);
    });

    console.log("Merkle Root:", root);
    return { root, proofs };
}

module.exports = { buildMerkleTree };
