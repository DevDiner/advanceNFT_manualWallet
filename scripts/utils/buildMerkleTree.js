const { MerkleTree } = require("merkletreejs");
const { keccak256 } = require("js-sha3");
const { ethers } = require("ethers");

function buildMerkleTree(addresses) {
    const leaves = addresses.map((address, index) => {
        const packed = ethers.solidityPacked(["uint256", "address"], [index, address]);
        return Buffer.from(ethers.toBeArray(ethers.keccak256(packed)));
    });

    const tree = new MerkleTree(leaves, (el) => Buffer.from(keccak256.arrayBuffer(el)), { sortPairs: true });
    
    const root = tree.getHexRoot();

    const proofs = {};
    addresses.forEach((address, index) => {
        proofs[address] = tree.getHexProof(leaves[index]);
    });

    return { root, proofs };
}

module.exports = { buildMerkleTree };
