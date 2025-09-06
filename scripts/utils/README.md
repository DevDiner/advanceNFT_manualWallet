# Scripts Utilities (`/scripts/utils`)

This directory contains low-level, specialized utility scripts that support the project's core functionalities and demonstrate a first-principles understanding of key blockchain concepts.

---

## `wallet.js` - From-Scratch Ethereum Wallet

### Purpose

The `wallet.js` script is a low-level, from-scratch implementation of a basic cryptocurrency wallet. Its primary purpose is to demonstrate a deep understanding of core Ethereum cryptography by manually handling nonces, gas, EIP-1559 fees, and raw transaction creation without relying on high-level wallet abstractions like `ethers.Wallet`.

This script is purely for educational and demonstrative purposes, as showcased in the `6_run_manual_wallet_mint.js` simulation.

### Architectural Distinction

It is critical to understand that this project contains two different types of "wallets" for two completely different jobs:

1.  **The High-Level Application Wallet (`ethers.js`)**: Used in the React frontend and most Hardhat scripts. This is the **industry best practice** for building secure, user-friendly dApps.
2.  **The Low-Level Manual Wallet (`wallet.js`)**: Used only in specific, educational scripts as a **"proof of knowledge."** A user's private key must **never** be exposed to a frontend application; this utility is safe because it runs in a trusted, local Node.js environment with access to the `.env` file.

---

## `buildMerkleTree.js` - Gas-Efficient Airdrop Whitelist

### Purpose

The `buildMerkleTree.js` utility is responsible for creating a **Merkle tree** from a list of whitelisted Ethereum addresses. This is a critical component for implementing a gas-efficient and scalable airdrop or presale system.

Instead of storing a massive list of addresses on-chain (which is prohibitively expensive), we only store a single 32-byte hash known as the **Merkle root**.

### How It Works

1.  **Input**: Takes an array of Ethereum addresses.
2.  **Hashing**: It correctly hashes each address with its index using `ethers.solidityPackedKeccak256(['uint256', 'address'], [index, addr])` to create the "leaf" nodes. This specific hashing scheme is crucial to match the verification logic inside the smart contract.
3.  **Tree Construction**: It builds a Merkle tree from these leaves.
4.  **Output**: It produces two essential artifacts:
    *   **`root`**: A single hexadecimal string. This root is passed to the smart contract's constructor to be stored on-chain.
    *   **`claims`**: A JSON object (`merkle-proofs.json`) that maps each whitelisted address to its unique proof and index. This file is served to the frontend, allowing users to fetch their proof and submit it to the smart contract to claim their NFT.

---

## `generate-keypair.js` - Cryptography Proof of Knowledge

### Purpose

The `generate-keypair.js` script is a utility for educational purposes to demonstrate a foundational understanding of Ethereum's public-key cryptography. It programmatically generates a new, random private key and then derives the corresponding public key and Ethereum address from first principles.

This script is not used in the live dApp but serves as a clear, standalone demonstration of the underlying mechanics described in the Ethereum Yellow Paper.

### The Process

The script logs each of the following steps to the console:

1.  **Generate Private Key**: Creates a new, cryptographically secure random 32-byte (256-bit) number. This is the private key.
2.  **Derive Public Key**: Uses the Elliptic Curve Digital Signature Algorithm (ECDSA) with the `secp256k1` curve to mathematically derive the public key from the private key.
3.  **Derive Ethereum Address**: Takes the Keccak-256 hash of the public key (excluding the `0x04` prefix) and then takes the last 20 bytes of that hash. This is the final, user-facing Ethereum address.
