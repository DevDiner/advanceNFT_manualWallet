

# Advanced Full-Stack NFT Project + Built From-Scratch Wallet Integration

This is a comprehensive, full-stack NFT project designed to serve as a professional portfolio piece. It demonstrates a deep understanding of advanced blockchain concepts, secure smart contract development, and modern dApp architecture, including a gasless experience via a custom meta-transaction relayer.

---

## Skills & Technologies Showcase

This project was built to demonstrate proficiency in a wide range of production-grade technologies and advanced blockchain concepts.

| Technology/Concept | Skills Demonstrated |
| :--- | :--- |
| **Smart Contracts (Solidity)** | **Advanced Contract Architecture:** Deep understanding of secure, gas-efficient, and feature-rich smart contract development using **OpenZeppelin Contracts**. |
| &nbsp;&nbsp;&nbsp;↳ Commit-Reveal Scheme | **Fair Minting & Front-Running Prevention:** Implementation of a two-step minting process with a timed reveal window to ensure fairness and unpredictability. |
| &nbsp;&nbsp;&nbsp;↳ Merkle Tree Airdrop | **Gas Efficiency & Scalability:** A gas-efficient system for managing a large presale whitelist on-chain, proving a deep understanding of data structures. |
| &nbsp;&nbsp;&nbsp;↳ On-Chain Art & Metadata | **100% On-Chain NFTs:** Generation and storage of generative SVG artwork and metadata directly on the blockchain, ensuring permanence and decentralization. |
| &nbsp;&nbsp;&nbsp;↳ Payment Splitting | **Financial Logic:** A mechanism to distribute minting revenue to multiple contributors based on a predefined share structure. |
| &nbsp;&nbsp;&nbsp;↳ Smart Contract Wallets | **Account Abstraction Principles:** A factory pattern for deploying personal smart contract wallets for users, enabling advanced features like meta-transactions. |
| **Backend (Node.js/Vercel)** | **Full-Stack & Serverless Architecture:** Building a robust backend service designed for a production-grade dApp and deploying it to a modern, scalable **serverless** platform (Vercel). |
| &nbsp;&nbsp;&nbsp;↳ Meta-Transaction Relayer | **Gasless User Experience:** A custom relayer that sponsors gas fees for users by securely accepting and broadcasting their signed, off-chain EIP-712 messages. |
| **Frontend (React/Vite/Ethers.js)** | **Modern & Responsive dApp Development:** Building a polished, user-friendly, and performant decentralized application. |
| &nbsp;&nbsp;&nbsp;↳ Multi-Asset Portfolio | **API Integration & Data Handling:** A wallet dashboard that integrates with the **Etherscan API** using a **resilient, throttled API client**. It discovers and displays a complete portfolio of ETH, ERC20, **ERC-721, and ERC-1155** assets. |
| &nbsp;&nbsp;&nbsp;↳ Network-Aware UI | **Robust User Experience:** The frontend intelligently adapts its features based on the connected network, offering a full portfolio view on public testnets and a functional, educational fallback on local development networks. |
| **DevOps & Tooling (Hardhat)** | **Professional Development Environment:** Mastery of the industry-standard toolchain for Ethereum development. |
| &nbsp;&nbsp;&nbsp;↳ Advanced Scripting | **Automation & Tooling:** A suite of robust scripts for deployment, state management, and end-to-end user journey simulations. |
| &nbsp;&nbsp;&nbsp;↳ Network-Aware Deployment | **Deployment Pipelines:** A single, reliable deployment script that handles both local development (Hardhat) and live testnets (Sepolia), including **automatic Etherscan verification**. |
| **Cryptography (From Scratch)** | **First-Principles Understanding:** A low-level `wallet.js` utility that demonstrates a deep understanding of core Ethereum cryptography by manually handling keys, nonces, gas, and raw transaction signing without high-level libraries. |

---

## Key Features

-   **Fair & Secure Minting:** Employs a commit-reveal scheme with a configurable reveal delay and expiry window to prevent front-running and guarantee a fair minting experience for all participants.
-   **Gasless User Onboarding & Transactions:** Users can create their own personal smart contract wallet with the gas fee sponsored by a custom-built relayer. Subsequent interactions, like minting, can also be performed gaslessly via meta-transactions.
-   **Multi-Asset Portfolio Dashboard:** A feature-rich "My Wallet" page that acts as a true portfolio viewer. On live testnets, it uses a robust, **rate-limit-aware** Etherscan API integration to automatically discover and display a wallet's balance of ETH, all **ERC20** tokens, and all **ERC-721 & ERC-1155** NFTs from any collection.
-   **100% On-Chain Generative Art:** NFT artwork is generated and stored directly on the blockchain as an SVG, making the asset entirely self-contained and permanent. The metadata URI is also generated on-chain.
-   **Gas-Efficient Airdrop System:** Utilizes a Merkle tree to manage the presale/airdrop whitelist, allowing for a virtually unlimited number of whitelisted users while keeping on-chain storage costs minimal.
-   **Revenue Splitting:** A built-in payment splitter allows minting revenue to be automatically and transparently distributed among multiple project contributors according to predefined shares.
-   **From-Scratch Cryptography Demo:** Includes a standalone `wallet.js` utility that manually performs all the steps of a raw Ethereum transaction—from key generation to signing and broadcasting—proving a first-principles understanding of the underlying cryptography.

---

## Comprehensive "How to Run" Guide

This guide covers every workflow for local development, live testnet interaction, and Vercel deployment.

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

#### 1A: Environment Setup (3 Terminals)

1.  **Terminal 1: Start Local Blockchain**
    ```bash
    npx hardhat node
    ```
    **Action:** Copy the "Private Key" for **"Account #0"**. You'll need this for MetaMask.

2.  **Terminal 2: Deploy Smart Contracts**
    ```bash
    npm run deploy
    ```
    **Action:** This creates `deployed-addresses.json`, `merkle-proofs.json`, and the `.env.local` file for the frontend.

3.  **Terminal 3: Start Frontend + Relayer (Vercel Dev Server)**
    This single command starts a local server that perfectly simulates the Vercel environment, running both the Vite frontend and the serverless API functions together.
    ```bash
    npm run dev:vercel
    ```
    **Action:** Open the URL it provides (e.g., `http://localhost:3000`).

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
    *   Click **`Commit with MetaMask (0.01 ETH)`** and **Confirm** in MetaMask.
    *   After the commit, wait for the reveal window (instant on Hardhat).
    *   Click **"Reveal & Mint NFT"** and **Confirm** in MetaMask.
    *   **Verification:** The "Last Minted NFT" preview will update.

#### 1D: Workflow 2 - Gasless Minting (Smart Wallet)

1.  **Set Sale State:** Ensure the sale is open (`npm run sale:public`).
2.  **Create Smart Wallet:** Navigate to the **"My Wallet"** page and click **"Create My Smart Wallet (Gasless)"**. The local Vercel server will handle the deployment.
3.  **Fund the Smart Wallet:**
    *   Copy your new **"Smart Wallet Address"**.
    *   In MetaMask, send **0.01 ETH** to this address.
4.  **Mint Gaslessly:**
    *   Navigate back to the **"Minter"** page.
    *   Click **"Generate Secure Secret"**.
    *   Click **"Commit Gaslessly via Smart Wallet"**. MetaMask will ask for a **signature** (free).
    *   After the commit, click **"Reveal & Mint NFT"** and **Sign** the second message.
    *   **Verification:** Navigate to "My Wallet". The new NFT will be in the gallery.

#### 1E: Workflow 3 - `wallet.js` Proof of Concept

1.  **Prerequisites:** Your local environment (Terminals 1, 2) must be running.
2.  **Configure User:** In `.env`, set `USER_PRIVATE_KEY` to the private key for "Account #3" from Terminal 1.
3.  **Run Script:** In a new terminal, execute `npm run sim:manual`.
4.  **Verification:** The script will output its progress, performing the full commit-reveal flow.

---

### Phase 2: Live Testing on Sepolia

This uses a real public testnet. **Before starting this phase, you must complete Phase 3 to get a public relayer URL.**

#### 2A: Environment and Deployment

1.  **Configure `.env` for Sepolia:**
    *   Fill out all the Sepolia-related variables in your `.env` file (RPC URL, private keys, Etherscan key, and the Vercel URL from Phase 3).
2.  **Fund Your Wallets:** Use a public faucet to get Sepolia ETH for your **Deployer** and **Relayer** wallets.
3.  **Deploy Contracts to Sepolia:**
    ```bash
    npm run deploy:sepolia
    ```
4.  **Start Frontend (Locally):**
    You can test against the live Sepolia contracts using your local Vercel dev server. It will automatically use the Sepolia configuration from `.env.local`.
    ```bash
    npm run dev:vercel
    ```
5.  **MetaMask:** Switch your MetaMask network to "Sepolia".

#### 2B: All Workflows on Sepolia

The user journeys are identical to the local versions.
*   **Setting Sale State:** Use the dedicated Sepolia scripts:
    ```bash
    npm run sale:public:sepolia
    ```
*   **Transaction Speed:** Transactions will take 15-30 seconds.
*   **Portfolio View:** The "My Wallet" page will now use the Etherscan API to show **all** your assets.
*   **Manual Wallet Script:** `npm run sim:manual:sepolia`

---

### Phase 3: Deploying to Vercel (Single Project)

This guide covers the modern, unified workflow for deploying your full-stack application (frontend and API) to a single Vercel URL.

#### 3A: Step 1 - Install Vercel CLI & Link Project

1.  **Install Vercel CLI:** `npm install -g vercel`
2.  **Login to Vercel:** `vercel login`
3.  **Link your local project:** `vercel link`
    *   Follow the prompts to create a **new Vercel project**. Vercel will automatically detect that you have a Vite frontend and serverless functions in the `/api` directory.

#### 3B: Step 2 - Configure Environment Variables on Vercel

Your serverless API functions need access to your secrets to operate on the Sepolia network.
1.  Go to your project's dashboard on the Vercel website.
2.  Navigate to **Settings -> Environment Variables**.
3.  Add the following variables, copying their values from your local `.env` file.

| Variable Name | Value | Description |
| :--- | :--- | :--- |
| `NETWORK` | `sepolia` | Tells the relayer to use the Sepolia RPC. |
| `SEPOLIA_RPC_URL`| `https://sepolia.infura.io/v3/...` | Your Sepolia RPC URL. |
| `RELAYER_PRIVATE_KEY`| `0x...` | The private key for your relayer wallet. |

#### 3C: Step 3 - The Vercel Deployment Workflow

Vercel provides three main commands for different environments.

1.  **Local Development (`npm run dev:vercel`)**
    *   **What it does:** Runs the entire Vercel environment (frontend + API) on your local machine.
    *   **Use it for:** All day-to-day development and testing on the Hardhat network.

2.  **Preview Deployment (`npm run deploy:vercel`)**
    *   **What it does:** Deploys your current code to a unique, temporary URL (e.g., `my-project-git-my-branch-hash.vercel.app`).
    *   **Use it for:** Testing your changes on a live network like Sepolia before merging them. Share this URL with teammates for review.

3.  **Production Deployment (`npm run deploy:vercel:prod`)**
    *   **What it does:** Deploys your code to the main, public URL for your project.
    *   **Use it for:** The final release when your changes are complete and tested.

**Action:** Run a preview deployment to get your initial relayer URL:
```bash
npm run deploy:vercel
```
Vercel will give you a public URL. **Copy this URL.**

#### 3D: Step 4 - Update Local Config & Re-Deploy Contracts

1.  **Update `.env` file:** Open your local `.env` file and add/update the `RELAYER_URL_SEPOLIA` variable with the URL you just copied.
    ```
    RELAYER_URL_SEPOLIA=https-your-project-preview-url.vercel.app
    ```
2.  **Re-run the deployment script:** This injects the new URL into the frontend's configuration.
    ```bash
    npm run deploy:sepolia
    ```
Your dApp is now configured to use your live relayer on the Sepolia network! You can now proceed to **Phase 2**.

---

## Developer Scripts Guide

| Command | Description |
| :--- | :--- |
| `npm run deploy` | Deploys contracts to the `localhost` network. |
| `npm run deploy:sepolia` | Deploys contracts to Sepolia and verifies them on Etherscan. |
| `npm run dev` | Starts the standard Vite dev server (frontend only). |
| `npm run dev:vercel` | Starts the **local Vercel development server** (frontend + API). |
| `npm run deploy:vercel` | Deploys a **preview** build to a unique Vercel URL for testing. |
| `npm run deploy:vercel:prod`| Deploys a **production** build to the main Vercel URL. |
| `npm run sale:public` | **Utility:** Sets sale state to `PublicSale` on `localhost`. |
| `npm run sale:public:sepolia` | **Utility:** Sets sale state to `PublicSale` on `sepolia`. |
| `npm run sim:public` | **Simulation:** Runs an end-to-end test of the public mint on `localhost`. |
| `npm run sim:airdrop` | **Simulation:** Runs an end-to-end test of the airdrop claim on `localhost`. |
| `npm run sim:manual` | **Simulation:** Runs the `wallet.js` demo to mint an NFT from scratch on `localhost`. |
| `npm run test` | Runs the automated gas-comparison test suite. |

---

## Project Structure

-   `/api`: Contains the Vercel-native serverless functions for the relayer backend.
-   `/contracts`: Contains all Solidity smart contracts.
-   `/scripts`: Holds all Hardhat scripts for automating development tasks.
-   `/src`: The source code for the React/Vite frontend dApp.
-   `hardhat.config.js`: The central configuration file for the Hardhat environment.
-   `vercel.json`: The configuration file for deploying the project to Vercel.