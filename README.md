# Advanced NFT Portfolio Project

This is a comprehensive, full-stack NFT project designed to serve as a professional portfolio piece. It demonstrates a deep understanding of advanced blockchain concepts, secure smart contract development, and modern full-stack dApp architecture.

The project includes a feature-rich React frontend for minting, a Hardhat environment for contract development and testing, and a production-style relayer server for meta-transactions.

## Core Features

1.  **Fair Minting with Commit-Reveal:** A two-step minting process (commit, then reveal) for both presale and public sale, preventing front-running and ensuring a fair and unpredictable minting experience for all users.

2.  **Merkle Tree Airdrop/Presale:** A gas-efficient system for managing a presale whitelist. The contract only stores a single 32-byte Merkle root, and users provide a cryptographic proof on the client-side to validate their eligibility.

3.  **On-Chain Generative Art & Rarity:** The NFT's metadata and image are generated and stored 100% on-chain. No IPFS or external servers are needed. The artwork is determined by a rarity score calculated at mint time, resulting in four tiers of generative SVG patterns:
    *   **Common (75%):** A smooth, two-color linear gradient.
    *   **Uncommon (20%):** A vibrant radial gradient ("glowing orb").
    *   **Rare (4.9%):** A dynamic pattern of generated stripes.
    *   **Legendary (0.1%):** An animated "lava lamp" effect using on-chain SVG animations.

4.  **Gas Consumption Comparison Test:** A dedicated test script (`gas-comparison.test.js`) that programmatically measures and compares the gas costs of using a `mapping` versus a `BitMaps.BitMap` library for tracking claimed airdrops.

5.  **Production-Style Meta-Transactions:**
    *   An EIP-712 compliant `SimpleWallet.sol` contract that allows users to sign messages off-chain.
    *   A dedicated **Node.js/Express relayer server** that listens for these signed messages and pays the gas fee to submit the transaction on the user's behalf. This demonstrates a complete, production-ready architecture for gasless transactions.

## Project Structure

```
.
├── contracts/          # Solidity Smart Contracts (AdvancedNFT.sol, SimpleWallet.sol)
├── relayer/            # Production-style meta-transaction relayer server
│   └── server.js
├── scripts/            # Hardhat scripts for deployment, testing, and interaction
├── test/               # Hardhat tests (gas comparison)
├── components/         # React components for the frontend
├── services/           # Frontend blockchain interaction logic (ethers.js)
├── .env.example        # Example environment file
├── hardhat.config.js   # Hardhat configuration
├── package.json        # Project dependencies and scripts
└── README.md           # This file
```

---

## Complete Setup and Deployment Guide

### Step 1: Prerequisites

*   **Node.js:** (v18 or later recommended).
*   **Git:** For cloning the project.
*   **Code Editor:** VS Code / VS Codium or your preferred editor.
*   **MetaMask:** Browser extension wallet.

### Step 2: Project Setup

1.  **Clone the Repository:**
    ```bash
    git clone <your-repo-url>
    cd <your-repo-folder>
    ```
2.  **Install Dependencies:**
    This single command installs all dependencies for both the Hardhat backend and the React frontend.
    ```bash
    npm install
    ```

### Step 3: Environment Configuration

1.  **Create `.env` file:**
    Copy the example file to create your local configuration file.
    ```bash
    cp .env.example .env
    ```
2.  **Fill in the variables in `.env`:**
    *   `SEPOLIA_RPC_URL`: Get this from a node provider like [Alchemy](https://www.alchemy.com/) or [Infura](https://www.infura.io/). This is required for deploying to a live testnet.
    *   `PRIVATE_KEY`: **CRITICAL:** The private key of the wallet you will use for deployment (the "owner"). **NEVER use a key that holds real funds.**
    *   `USER_PRIVATE_KEY`: The private key of a separate, secondary wallet for testing user journeys (presale minting, public minting, etc.).
    *   `RELAYER_PRIVATE_KEY`: The private key for a third wallet that will act as the gas-paying relayer for meta-transactions.
    *   `ETHERSCAN_API_KEY`: (Optional) Get a free API key from [Etherscan](https://etherscan.io/myapikey) to verify your contract's source code.

### Step 4: Critical Deployment Sequence

Before running the application, you **must** perform these steps in order. The application services (like the relayer) depend on files that are created during these steps.

1.  **Compile the Smart Contracts:**
    This command checks your Solidity code for errors and generates the necessary ABI and bytecode artifacts.

    ```bash
    npm run compile
    ```

2.  **Deploy the Smart Contracts:**
    This command deploys your contracts to the configured network and creates the `deployed-addresses.json` file that other services need.
    *   **For local testing:** `npm run deploy`
    *   **For live testnet:** `npm run deploy:sepolia`

---

## Running the Application

### Option A: Full Local Development Environment (Recommended First)

This lets you test the entire application stack on a private blockchain running on your machine. **You will need four separate terminals.**

1.  **Terminal 1: Start a Local Node**
    ```bash
    npx hardhat node
    ```
    This starts a local Ethereum node and lists 20 test accounts.

2.  **Terminal 2: Deploy Contracts Locally**
    (Only needed once per session)
    ```bash
    npm run deploy
    ```
    This terminal is now free for running other interaction scripts.

3.  **Terminal 3: Start the Relayer Server**
    (Make sure you have compiled and deployed locally first!)
    ```bash
    npm run start:relayer
    ```

4.  **Terminal 4: Run the Frontend**
    ```bash
    npm run dev
    ```
    Now, open the URL it provides (e.g., `http://localhost:3000`) in your browser.

5.  **Connect MetaMask to Localhost and Use the App:**
    *   Open MetaMask > Add Network > Add a network manually.
    *   **Network Name:** `Hardhat Local`
    *   **New RPC URL:** `http://127.0.0.1:8545`
    *   **Chain ID:** `1337`
    *   **Currency Symbol:** `GO`
    *   Import one of the test accounts from the `npx hardhat node` output using its private key.

### Option B: Live Testnet Deployment (Sepolia)

1.  **Get Sepolia Test ETH:** Fund your wallets (Deployer, User, Relayer) with free Sepolia ETH from a public faucet like [sepoliafaucet.com](https://sepoliafaucet.com/).

2.  **Deploy to Sepolia:**
    (Make sure you have compiled first!)
    ```bash
    npm run deploy:sepolia
    ```

3.  **Run Frontend & Relayer:** Start the frontend (`npm run dev`) and relayer (`npm run start:relayer`) in separate terminals. Your dApp is now live and interacting with the Sepolia testnet.

---

## How to Run Scripts and Tests

All scripts should be run from the project's root directory.

### Core Scripts

*   **Run a specific interaction script:**
    ```bash
    # Example: Test the public sale flow on localhost
    npx hardhat run scripts/2_run_public_sale.js --network localhost
    ```

*   **Run the Gas Comparison Test:**
    ```bash
    npm test
    ```

*   **Run an interaction script (e.g., public sale simulation):**
    ```bash
    npx hardhat run scripts/2_run_public_sale.js --network localhost
    ```
    The server will log that it's listening on port 3001 and will show its relayer wallet address. Ensure this wallet is funded with ETH for gas.

*   **Run the meta-transaction client script (requires relayer to be running):**
    ```bash
    # This script sends a request to the server running on localhost
    npx hardhat run scripts/5_run_meta_tx_via_relayer.js --network localhost
    ```
    You will see logs in the client terminal as it sends the request, and logs in the server terminal as it receives the request and submits the transaction to the blockchain.

### Operational Scripts

#### Relayer Balance Monitoring
This script checks the balance of the relayer wallet and alerts you if it falls below a set threshold. In a production environment, you would automate this script to run periodically (e.g., as a cron job).

*   **Monitor the relayer's balance:**
    ```bash
    # on Hardhat
    npm run monitor
    
    # on Sepolia
    npm run monitor:relayer
    ```

*   **Generate a new keypair (educational utility):**
    ```bash
    npm run generate-keypair
    ```

### To verify AdvancedNFT.sol on Sepolia
```bash
    npx hardhat verify --network sepolia   --constructor-args scripts/verify-args.js [CONTRACT_ADDRESS]
```

### To verify SimpleWallet.sol on Sepolia
``` bash 
    npx hardhat verify --network sepolia [CONTRACT_ADDRESS]
```