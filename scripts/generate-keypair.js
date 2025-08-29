// SCRIPT: GENERATE KEYPAIR
// ==========================
// This script is a utility for educational purposes to demonstrate a deep
// understanding of core Ethereum cryptography, as described in the Yellow Paper.
// It programmatically generates a new, random private key and then derives the
// corresponding public key and Ethereum address from scratch.
//
// This is NOT used in the live dApp's secure wallet architecture but serves as
// a clear "proof of knowledge" of the underlying principles.

const { randomBytes } = require("crypto");
const { ec: EC } = require("elliptic");
const { keccak256 } = require("js-sha3");

function generateKeypair() {
  console.log("--- Generating New Ethereum Keypair From Scratch ---");

  // Step 1: Generate a new random 32-byte private key.
  // An Ethereum private key is simply a cryptographically secure random 256-bit number.
  const privateKeyBytes = randomBytes(32);
  const privateKey = "0x" + privateKeyBytes.toString("hex");
  console.log("\n1. Generated Private Key:");
  console.log(`   ${privateKey}`);
  console.log(`   (This is your secret. Never share it.)`);

  // Step 2: Derive the public key from the private key.
  // This is done using the Elliptic Curve Digital Signature Algorithm (ECDSA)
  // with the `secp256k1` curve, as specified by Ethereum.
  const ec = new EC("secp256k1");
  const key = ec.keyFromPrivate(privateKeyBytes);
  const publicKey = "0x" + key.getPublic(false, "hex"); // `false` for uncompressed format
  console.log("\n2. Derived Public Key:");
  console.log(`   ${publicKey}`);
  console.log(`   (This is derived mathematically from the private key.)`);

  // Step 3: Derive the Ethereum address from the public key.
  // The address is the last 20 bytes of the Keccak-256 hash of the public key.
  // Note: We hash the public key *without* the leading '0x04' prefix.
  const publicKeyBytes = Buffer.from(publicKey.slice(4), "hex");
  const hashedPublicKey = keccak256(publicKeyBytes);
  const address = "0x" + hashedPublicKey.slice(-40);
  console.log("\n3. Derived Ethereum Address:");
  console.log(`   ${address}`);
  console.log(
    `   (This is the last 20 bytes of the Keccak-256 hash of the public key.)`
  );

  console.log("\n----------------------------------------------------");
}

generateKeypair();

module.exports = { generateKeypair };
