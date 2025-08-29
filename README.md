
# Advanced Full-Stack NFT Project + Built From-Scratch Wallet Integration

This is a comprehensive, full-stack NFT project designed to serve as a professional portfolio piece. It demonstrates a deep understanding of advanced blockchain concepts, secure smart contract development, and modern dApp architecture, including a gasless experience via a custom meta-transaction relayer.

---

## Skills & Technologies Showcase

This project was built to demonstrate proficiency in a wide range of production-grade technologies and advanced blockchain concepts.

| Technology/Concept | Skills Demonstrated |
| :--- | :--- |
| **Smart Contracts (Solidity)** | **Advanced Contract Architecture:** Deep understanding of secure, gas-efficient, and feature-rich smart contract development using **OpenZeppelin Contracts**. |
| &nbsp;&nbsp;&nbsp;↳ **Commit-Reveal Scheme** | **Fair Minting & Front-Running Prevention:** Implementation of a two-step minting process with a timed reveal window to ensure fairness and unpredictability. |
| &nbsp;&nbsp;&nbsp;↳ **Merkle Tree Airdrop** | **Gas Efficiency & Scalability:** A gas-efficient system for managing a large presale whitelist on-chain, proving a deep understanding of data structures. |
| &nbsp;&nbsp;&nbsp;↳ **On-Chain Art & Metadata** | **100% On-Chain NFTs:** Generation and storage of generative SVG artwork and metadata directly on the blockchain, ensuring permanence and decentralization. |
| &nbsp;&nbsp;&nbsp;↳ **Payment Splitting** | **Financial Logic:** A mechanism to distribute minting revenue to multiple contributors based on a predefined share structure. |
| &nbsp;&nbsp;&nbsp;↳ **Smart Contract Wallets** | **Account Abstraction Principles:** A factory pattern for deploying personal smart contract wallets for users, enabling advanced features like meta-transactions. |
| **Backend (Node.js/Express)** | **Full-Stack Web3 Development:** Building a robust backend service to support a production-grade dApp with proper security and error handling. |
| &nbsp;&nbsp;&nbsp;↳ **Meta-Transaction Relayer** | **Gasless User Experience:** A custom relayer that sponsors gas fees for users by securely accepting and broadcasting their signed, off-chain EIP-712 messages. |
| **Frontend (React/Vite/Ethers.js)** | **Modern & Responsive dApp Development:** Building a polished, user-friendly, and performant decentralized application. |
| &nbsp;&nbsp;&nbsp;↳ **Multi-Asset Portfolio** | **API Integration & Data Handling:** A wallet dashboard that integrates with the **Etherscan API** to discover and display a user's complete portfolio of ETH, ERC20 tokens, and NFTs from any collection. |
| &nbsp;&nbsp;&nbsp;↳ **Network-Aware UI** | **Robust User Experience:** The frontend intelligently adapts its features based on the connected network, offering a full portfolio view on public testnets and a functional, educational fallback on local development networks. |
| **DevOps & Tooling (Hardhat)** | **Professional Development Environment:** Mastery of the industry-standard toolchain for Ethereum development. |
| &nbsp;&nbsp;&nbsp;↳ **Advanced Scripting** | **Automation & Tooling:** A suite of robust scripts for deployment, state management, and end-to-end user journey simulations. |
| &nbsp;&nbsp;&nbsp;↳ **Network-Aware Deployment** | **Deployment Pipelines:** A single, reliable deployment script that handles both local development (Hardhat) and live testnets (Sepolia), including **automatic Etherscan verification**. |
| **Cryptography (From Scratch)** | **First-Principles Understanding:** A low-level `wallet.js` utility that demonstrates a deep understanding of core Ethereum cryptography by manually handling keys, nonces, gas, and raw transaction signing without high-level libraries. |

---

## Key Features

-   **Fair & Secure Minting:** Employs a commit-reveal scheme with a configurable reveal delay and expiry window to prevent front-running and guarantee a fair minting experience for all participants.
-   **Gasless User Onboarding & Transactions:** Users can create their own personal smart contract wallet with the gas fee sponsored by a custom-built relayer. Subsequent interactions, like minting, can also be performed gaslessly via meta-transactions.
-   **Multi-Asset Portfolio Dashboard:** A feature-rich "My Wallet" page that acts as a true portfolio viewer. On live testnets, it uses the Etherscan API to automatically discover and display the wallet's balance of ETH, all ERC20 tokens, and all NFTs from any collection.
-   **100% On-Chain Generative Art:** NFT artwork is generated and stored directly on the blockchain as an SVG, making the asset entirely self-contained and permanent. The metadata URI is also generated on-chain.
-   **Gas-Efficient Airdrop System:** Utilizes a Merkle tree to manage the presale/airdrop whitelist, allowing for a virtually unlimited number of whitelisted users while keeping on-chain storage costs minimal.
-   **Revenue Splitting:** A built-in payment splitter allows minting revenue to be automatically and transparently distributed among multiple project contributors according to predefined shares.
-   **From-Scratch Cryptography Demo:** Includes a standalone `wallet.js` utility that manually performs all the steps of a raw Ethereum transaction—from key generation to signing and broadcasting—proving a first-principles understanding of the underlying cryptography.

---

## Comprehensive "How to Run" Guide

This guide covers every workflow for both local development and live testnet interaction.

### Phase 0: Initial Project Setup (One-Time)

1.  **Clone the Repository:**
    ```bash
    git clone <repo-url>
    cd <your-repo-folder>
    ```
2.  **Install Dependencies:**
    ```bash
    npm install
    ```
3.  **Configure Environment Variables:**
    *   Copy the example environment file: `cp .env.example .env`
    *   Open the newly created `.env` file and fill it out.
        *   For **local Hardhat development**, you can leave the placeholder private keys as they are.
        *   For **Sepolia deployment**, you will need to provide real private keys and API keys.

---

### Phase 1: Local Testing on Hardhat

This is the ideal environment for rapid development. Transactions are instant and require no real funds.

#### 1A: Environment Setup (4 Terminals)

Open four separate terminal windows in your project directory.

1.  **Terminal 1: Start Local Blockchain**
    ```bash
    npx hardhat node
    ```
    **Action:** Copy the "Private Key" for **"Account #0"**. You'll need this for MetaMask.

2.  **Terminal 2: Deploy Smart Contracts**
    ```bash
    npm run deploy
    ```
    **Action:** Wait for it to complete. It creates `deployed-addresses.json`, `merkle-proofs.json`, and the crucial `.env.local` file for the frontend.

3.  **Terminal 3: Start Relayer Server**
    ```bash
    npm run start:relayer
    ```

4.  **Terminal 4: Start Frontend dApp**
    ```bash
    npm run dev
    ```
    **Action:** Open the URL it provides (e.g., `http://localhost:5173`).

#### 1B: MetaMask Configuration

*   **Add Network:** Add a new network in MetaMask:
    *   **Network Name:** `Hardhat Local`
    *   **RPC URL:** `http://127.0.0.1:8545`
    *   **Chain ID:** `1337`
*   **Import Account:** Import "Account #0" into MetaMask using the private key you copied. This account is the contract owner and is automatically on the airdrop whitelist.

#### 1C: Workflow 1 - Standard Minting (User Pays Gas)

1.  **Set Sale State:** In a **new terminal**, use the utility command:
    ```bash
    npm run sale:public
    ```
2.  **Connect & Mint:**
    *   Go to the dApp website and refresh. The status should be "Public Sale Active".
    *   Click **"Connect Wallet"**.
    *   On the "Minter" page, click **"Generate Secure Secret"**.
    *   Click the **`Commit with MetaMask (0.01 ETH)`** button and **Confirm** in MetaMask.
    *   After the commit succeeds, wait for the reveal window to open (this is instant on Hardhat).
    *   Click the **"Reveal & Mint NFT"** button and **Confirm** in MetaMask.
    *   **Verification:** The "Last Minted NFT" preview will update with your new on-chain art.

#### 1D: Workflow 2 - Gasless Minting (Smart Wallet)

1.  **Set Sale State:** Ensure the sale is open (`npm run sale:public`).
2.  **Create Smart Wallet:** Navigate to the **"My Wallet"** page and click **"Create My Smart Wallet (Gasless)"**. The relayer will deploy your wallet.
3.  **Fund the Smart Wallet:** The relayer pays for gas, but the user pays the mint price.
    *   Copy your new **"Smart Wallet Address"** from the dashboard.
    *   In MetaMask, send **0.01 ETH** to this address.
4.  **Mint Gaslessly:**
    *   Navigate back to the **"Minter"** page.
    *   Click **"Generate Secure Secret"**.
    *   Click **"Commit Gaslessly via Smart Wallet"**. MetaMask will ask for a **signature** (free). **Sign** the message.
    *   After the relayer processes the commit, click **"Reveal & Mint NFT"** and **Sign** the second message.
    *   **Verification:** Navigate to the "My Wallet" page. The new NFT will appear in the gallery, and the ETH balance will have decreased.

#### 1E: Workflow 3 - `wallet.js` Proof of Concept

This script demonstrates your from-scratch wallet by minting an NFT without the frontend.

1.  **Prerequisites:** Your local environment (Terminals 1, 2, 3) must be running.
2.  **Configure User:** In `.env`, set `USER_PRIVATE_KEY` to the private key for "Account #3" from Terminal 1.
3.  **Run Script:** In a new terminal, execute `npm run sim:manual`.
4.  **Verification:** The script will output its progress, performing the full commit-reveal flow from scratch and confirming the mint.

---

### Phase 2: Live Testing on Sepolia

This uses a real public testnet. Transactions are permanent and require real testnet funds.

#### 2A: Environment and Deployment

1.  **Configure `.env` for Sepolia:**
    *   `SEPOLIA_RPC_URL`: Your RPC URL for Sepolia (from Alchemy, Infura, etc.).
    *   `PRIVATE_KEY`: Private key of your **Deployer/Owner** wallet.
    *   `RELAYER_PRIVATE_KEY`: Private key of your **Relayer** wallet.
    *   `USER_PRIVATE_KEY`: Private key of a separate **Test User** wallet.
    *   `ETHERSCAN_API_KEY`: Your Etherscan API key for contract verification.
2.  **Fund Your Wallets:** Use a public faucet (e.g., [sepoliafaucet.com](https://sepoliafaucet.com/)) to get Sepolia ETH for your **Deployer** and **Relayer** wallets.
3.  **Deploy to Sepolia:** Run the deployment script. This will also verify the contracts on Etherscan.
    ```bash
    npm run deploy:sepolia
    ```
4.  **Start Relayer & Frontend:** In separate terminals:
    ```bash
    npm run start:relayer # Terminal 1
    npm run dev           # Terminal 2
    ```
5.  **MetaMask:** Switch your MetaMask network to "Sepolia".

#### 2B: All Workflows on Sepolia

The user journeys are identical to the local versions, with a few key differences:

*   **Setting Sale State:** To set the sale state on Sepolia, you must pass the network flag through the npm command. See the disclaimer below.
    ```bash
    npm run sale:public -- --network sepolia
    ```
*   **Transaction Speed:** Transactions will take 15-30 seconds to confirm.
*   **Portfolio View:** On the "My Wallet" page, the dashboard will now use the Etherscan API to discover and display **all ERC20 tokens and NFTs** your smart wallet owns.
*   **Manual Wallet Script:** To run the `wallet.js` demo on Sepolia:
    ```bash
    npx hardhat run scripts/6_run_manual_wallet_mint.js --network sepolia
    ```
*   **Verification:** You can track all your transactions and view your verified contracts on [Sepolia Etherscan](https://sepolia.etherscan.io/).

---

## Developer Scripts Guide

| Command | Description |
| :--- | :--- |
| `npm run deploy` | Deploys contracts to the local Hardhat network. |
| `npm run deploy:sepolia` | Deploys contracts to the Sepolia testnet and verifies them on Etherscan. |
| `npm run start:relayer` | Starts the backend meta-transaction relayer server. |
| `npm run sale:public` | **Utility:** Sets the NFT contract sale state to `PublicSale`. |
| `npm run sale:presale` | **Utility:** Sets the NFT contract sale state to `Presale` (Airdrop). |
| `npm run sale:closed` | **Utility:** Sets the NFT contract sale state to `Closed`. |
| `npm run sim:public` | **Simulation:** Runs an automated, end-to-end test of the public mint flow. |
| `npm run sim:airdrop` | **Simulation:** Runs an automated, end-to-end test of the airdrop claim flow. |
| `npm run sim:manual` | **Simulation:** Runs the `wallet.js` demo to mint an NFT from scratch. |
| `npm test` | Runs the automated gas-comparison test suite. |
| `npm run generate-keypair` | **Utility:** Generates a new keypair to demonstrate cryptographic principles. |
| `npm run monitor:relayer` | **Utility:** Checks and reports the balance of the relayer wallet. |

### A Note on the Double Dash (`--`) Syntax

When running some scripts for a specific network, you will see a double dash (`--`) in the command, like this:
`npm run sale:public -- --network sepolia`

**The `--` is a special separator.** It tells `npm` to stop parsing arguments for itself and to pass everything that comes after it directly to the underlying script. In this case, it ensures that `--network sepolia` is correctly passed to Hardhat, allowing our utility scripts to work on any network.

---

## Project Structure

This project is organized as a monorepo with clear separation of concerns between the different parts of the full-stack application.

-   `/contracts`: Contains all Solidity smart contracts (`AdvancedNFT.sol`, `SimpleWallet.sol`, `SimpleWalletFactory.sol`). This is the on-chain logic.
-   `/scripts`: Holds all Hardhat scripts for automating development tasks.
    -   `/scripts/utils`: Contains shared utilities used by other scripts, such as the Merkle tree builder and the from-scratch `wallet.js`.
    -   `0_deploy.js`: The single, reliable script for deploying and configuring all contracts.
    -   `1_...` & `2_...`: End-to-end simulation scripts for the main user journeys.
    -   Other scripts are developer utilities for testing and management.
-   `/relayer`: The complete Node.js/Express backend server for meta-transactions. It has its own logic for handling API requests, validating data, and submitting transactions to the blockchain.
-   `/src`: The source code for the React/Vite frontend dApp.
    -   `/src/components`: Contains all the reusable React components.
        -   `/src/components/shared`: Contains generic, reusable UI components like buttons and cards.
    -   `/src/services`: Handles all communication with the blockchain and external APIs.
    -   `App.tsx`: The main application component that manages top-level state.
    -   `config.ts`: The environment-aware configuration file for the frontend.
-   `/test`: The automated test suite (using Chai) for the smart contracts.
-   `hardhat.config.js`: The central configuration file for the Hardhat development environment, including the custom `set-sale-state` task.
-   `deployed-addresses.json`: An auto-generated file that stores the addresses of the most recently deployed contracts for the backend scripts to use.
-   `.env.local`: An auto-generated file that stores public configuration variables for the frontend.
