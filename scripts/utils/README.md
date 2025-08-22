# Built a wallet from scratch (`wallet.js`)

This directory contains the `wallet.js` script, a low-level, from-scratch implementation of a basic cryptocurrency wallet. Its primary purpose is to fulfill the assignment requirement of manually handling nonces, gas, and raw transaction creation without the use of high-level wallet libraries like `ethers.Wallet`.

This document explains its purpose, its architectural role in the project, and how to use it.

---

## Architectural Distinction: The Two Worlds

It is critical to understand that this project contains two different types of "wallets" for two completely different jobs:

1.  **The High-Level Application Wallet (`ethers.js`):**
    *   **Where it's used:** In the React frontend and most of the Hardhat scripts.
    *   **Purpose:** To provide a safe, reliable, and user-friendly way for the public to interact with the dApp website and for developers to write clear, maintainable scripts. This is the **industry best practice** for building real applications.

2.  **The Low-Level Manual Wallet (`wallet.js`):**
    *   **Where it's used:** Only in specific, educational scripts (`6_run_manual_wallet_mint.js`).
    *   **Purpose:** To serve as a **"proof of knowledge."** It demonstrates a deep, first-principles understanding of Ethereum's core mechanics as required by the assignment.

### Why Can't a User Interact with the dApp Using `wallet.js`?

This is a fundamental security principle.

*   **The Storefront (The dApp Website):** A public website runs in a secure "sandbox" in a user's browser. For security, this sandbox **cannot access local files** on the user's computer. It can never ask for or read a private key from a file like `.env`.
*   **The Back Office (The `wallet.js` Script):** This is a developer's tool that runs in a trusted Node.js environment. It has full access to the file system and can safely read a private key from your local `.env` file.

A user must **never** be asked to provide their private key to a website. Instead, the website sends a request to a secure browser extension like **MetaMask**, which acts as a firewall and asks the user for permission before signing anything.

---

## How to Use `wallet.js` to Interact with with our dApp

While a user cannot use it, you, the developer, can use `wallet.js` to call any function on the deployed smart contract. This is an excellent way to run automated tasks or to prove that your manual wallet implementation can handle complex interactions.

The script `6_run_manual_wallet_mint.js` is a perfect example of this. It uses the `wallet.js` utility to perform a complete commit-reveal mint.

### Step-by-Step Guide:

1.  **Ensure Your Environment is Set Up:**
    *   Make sure you have a `USER_PRIVATE_KEY` set in your `.env` file. This is the wallet the script will use.
    *   Start a local Hardhat node in a separate terminal:
        ```bash
        npx hardhat node
        ```
    *   Deploy your contracts to the local node:
        ```bash
        npm run deploy
        ```

2.  **Run the Manual Mint Script:**
    In your terminal, run the following command:
    ```bash
    npm run manual-mint
    ```

### What the Script Does:

1.  **ABI-Encoding:** It uses `ethers.Interface` (as a helper tool, not a wallet) to manually encode the `commitPublic` and `revealPublic` function calls into the raw hexadecimal `calldata` that the Ethereum Virtual Machine (EVM) understands.
2.  **Manual Transaction Creation:** It passes this `calldata`, along with the contract address and any required ETH value, to the `buildAndSendTx` function in `wallet.js`.
3.  **From-Scratch Signing & Broadcasting:** Your `wallet.js` script then takes over and performs all the low-level steps completely from scratch:
    *   It manually fetches the nonce.
    *   It manually estimates the gas fees.
    *   It manually RLP-encodes the transaction payload.
    *   It signs the transaction hash using the `elliptic` library.
    *   It broadcasts the final, signed raw transaction to the blockchain.

This script is the ultimate demonstration of your project's low-level cryptographic knowledge and your mastery of the full stack.
