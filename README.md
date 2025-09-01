

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

## Comprehensive 'How to Run' Guide

This guide covers every workflow for local development, live testnet interaction, and Vercel deployment.

### Phase 0: Initial Project Setup (One-Time)

1.  **Clone the Repository:**
    ```bash
    git clone <repo-url>
    cd <repo-folder>
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
    **Action:** This creates `deployed-addresses.json`, `public/merkle-proofs.json`, `api-artifacts.json`, and the `.env.local` file for the frontend.

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

## The Definitive Vercel Deployment Guide (End-to-End)

Follow these steps to deploy the entire full-stack application (frontend dApp and backend relayer) to a single, live Vercel URL on the Sepolia testnet.

### Step 1: Deploy Contracts & Generate Local Files

First, you need to deploy your smart contracts to Sepolia. This action also generates the critical files that the frontend and backend need.

1.  **Fund Your Wallet:** Ensure the wallet corresponding to your `PRIVATE_KEY` in `.env` has Sepolia ETH to pay for the contract deployment gas fees.
2.  **Run the Sepolia Deployment Script:**
    ```bash
    npm run deploy:sepolia
    ```
    **What this does:**
    *   Deploys your `AdvancedNFT` and `SimpleWalletFactory` contracts to the Sepolia network.
    *   Generates `public/merkle-proofs.json` for the airdrop.
    *   Generates `deployed-addresses.json` and `api-artifacts.json` for the backend relayer.
    *   Creates/updates the `.env.local` file with the new Sepolia contract addresses for the frontend.

### Step 2: Commit Deployment Artifacts to GitHub

The Vercel build process is clean; it only has access to files you've committed to your repository. The deployment script generates critical files that both the frontend and backend need to function.

1.  **Add the files to Git:**
    ```bash
    git add public/merkle-proofs.json deployed-addresses.json api-artifacts.json
    ```
2.  **Commit and Push:**
    ```bash
    git commit -m "feat: Add artifacts for Sepolia deployment"
    git push
    ```

### Step 3: Link Project and Deploy to Vercel

This step connects your local repository to a Vercel project and performs the initial deployment.

1.  **Install & Login to Vercel CLI:**
    ```bash
    npm install -g vercel
    vercel login
    ```
2.  **Link Your Project:** In your project directory, run:
    ```bash
    vercel link
    ```
    Follow the prompts to create a **new Vercel project**. Vercel will automatically detect the Vite frontend and the serverless API in the `/api` directory.
3.  **Run the First Preview Deployment:**
    ```bash
    npm run deploy:vercel
    ```
    This command builds and deploys your project to a unique preview URL.

### Step 4: Configure Environment Variables on Vercel

Your live application needs its secrets to function.

1.  Go to your project's dashboard on the Vercel website.
2.  Navigate to **Settings -> Environment Variables**.
3.  Add the following variables, copying their values from your local `.env` file. These are essential for the backend relayer and the frontend application to work correctly.

| Variable Name | Value | Description |
| :--- | :--- | :--- |
| `NETWORK` | `sepolia` | **(Backend)** Tells the relayer which network to use. |
| `SEPOLIA_RPC_URL`| `https://sepolia.infura.io/v3/...` | **(Backend)** Your Sepolia RPC URL for the relayer. |
| `RELAYER_PRIVATE_KEY`| `0x...` | **(Backend)** The private key for your relayer wallet. **This is highly sensitive.** |
| `VITE_SEPOLIA_RPC_URL` | `https://sepolia.infura.io/v3/...`| **(Frontend)** The same RPC URL, but prefixed with `VITE_` to expose it to the frontend. |
| `VITE_ETHERSCAN_API_KEY` | `YourEtherscanApiKey`| **(Frontend)** Your Etherscan API key for the portfolio viewer. |

### Step 5: Final Production Deployment

Now that Vercel has all the required secrets, you must re-deploy your application so they can be included in the build.

1.  **Run the Production Deploy Command:**
    ```bash
    npm run deploy:vercel:prod
    ```
    This triggers a new build and deployment to your main production URL. This final version will have all the environment variables correctly configured.

### Step 6: You're Live!

Congratulations! Your full-stack dApp is now live and fully functional. You can now proceed to the **"Post-Deployment User & Operator Guide"** below to test every feature.

---

## Post-Deployment: A Comprehensive User & Operator Guide

Once your dApp is live on Vercel and your contracts are on the Sepolia testnet, use this guide to test every feature from both an administrative and a user perspective.

### Phase 1: Pre-Flight Checklist (Your Operator Setup)

Before you can test, you need to configure your own tools to interact with your live dApp.

#### **1. Configure MetaMask for Sepolia**

*   **Switch Network:** Open MetaMask and ensure you are connected to the **Sepolia** network.
*   **Import Owner Account:** This is the most crucial step for administrative tasks.
    *   In your local `.env` file, find the `PRIVATE_KEY` you used for deployment. This is your **Owner/Deployer** account.
    *   In MetaMask, click the account icon -> "Import account" and paste this private key. Give it a clear name like `NFT Project Owner`.
*   **Import User Account:** To simulate a real user, it's best to use a different account.
    *   Find the `USER_PRIVATE_KEY` in your `.env` file.
    *   Import this key into MetaMask as well. Name it `Test User EOA`.
*   **Fund Your Wallets:** Make sure both the `NFT Project Owner` and `Test User EOA` accounts have some Sepolia ETH. If you need more, use a public faucet like [Alchemy's Sepolia Faucet](https://sepoliafaucet.com/).

#### **2. Open Your Live dApp**
Open the main production Vercel URL for your project.

---

### Phase 2: Administrative Control (Changing the Sale State)

As the contract owner, you control the minting process. This is done from your **local command line**, which sends a transaction to the live Sepolia contract.

1.  **Open a Terminal** in your project directory.
2.  **Connect as the Owner:** In MetaMask, make sure you are switched to your `NFT Project Owner` account. This is the account that will sign the transaction.

#### **Action: Open the Public Sale**

Run the following command. This tells your Hardhat setup to send a transaction to the live Sepolia contract to change its state.

```bash
npm run sale:public:sepolia
```

*   **What's Happening:** Your terminal will show the transaction being sent. This will cost a small amount of Sepolia ETH for gas.
*   **Verification:** Wait for the transaction to confirm. Then, go to your live Vercel dApp and **refresh the page**. The status on the "Minter" page should now read **"Public Sale Active"**.

You can use the other commands at any time to change the state:
*   `npm run sale:presale:sepolia` (for Airdrop/Whitelist)
*   `npm run sale:closed:sepolia` (to pause the mint)

---

### Phase 3: The Full User Experience

Now, let's test every feature from the perspective of a regular user.

#### **User Journey 1: Standard Mint (EOA Pays Gas)**

This tests the core commit-reveal flow.

1.  **Switch to User Account:** In MetaMask, switch to your `Test User EOA` account.
2.  **Connect to dApp:** On your Vercel site, click **"Connect Wallet"**.
3.  **Navigate to Minter:** Go to the "Minter" tab. The status should be "Public Sale Active".
4.  **Commit:**
    *   Click **"Generate Secure Secret"**.
    *   Click **`Commit with MetaMask (0.01 ETH)`**.
    *   MetaMask will pop up, asking you to confirm a transaction that sends 0.01 ETH. **Confirm it**.
5.  **Wait for Reveal Window:**
    *   On Sepolia, the reveal delay is a few minutes. The UI will show a "Waiting for Reveal Window" message with the target block number.
6.  **Reveal & Mint:**
    *   Once the current block is past the "earliest reveal block," the UI will change to "Ready to Reveal!".
    *   Click **"Reveal & Mint NFT"**.
    *   MetaMask will pop up again, this time asking you to confirm a transaction that only costs gas. **Confirm it**.
7.  **Verification:**
    *   The **"Last Minted NFT"** preview on the left will update to show your new, unique, on-chain generative art!

#### **User Journey 2: The Gasless Experience (Smart Wallet & Relayer)**

**Step A: Create the Smart Wallet**

1.  **Navigate to "My Wallet":** Click the "My Wallet" tab.
2.  **Initiate Creation:** Click **"Create My Smart Wallet (Gasless)"**.
3.  **The Magic:** The relayer will deploy your wallet on Sepolia, sponsoring the gas. After a minute, the UI will update to show your new Smart Wallet dashboard.

**Step B: Fund the Smart Wallet**

1.  **Get the Address:** On the "My Wallet" page, copy the **"Smart Wallet Address"**.
2.  **Send Funds:** Open MetaMask (using your `Test User EOA`). Send exactly **0.01 Sepolia ETH** to the smart wallet address. The wallet must hold the mint price.

**Step C: Perform the Gasless Mint**

1.  **Navigate to Minter:** Go back to the "Minter" tab.
2.  **Commit (Gaslessly):**
    *   Click **"Generate Secure Secret"**.
    *   Click **"Commit Gaslessly via Smart Wallet"**.
    *   MetaMask will pop up with a **free Signature Request**. **Sign it**.
3.  **Wait for Reveal Window:** Wait for the reveal window to open.
4.  **Reveal (Gaslessly):**
    *   Click **"Reveal & Mint NFT"**.
    *   MetaMask will pop up with another **free Signature Request**. **Sign it**.
5.  **Verification:**
    *   Navigate back to the **"My Wallet"** page.
    *   Click the **"NFTs"** tab in the **"Smart Wallet"** view. **Your new NFT will appear in the gallery!**

---

### Phase 4: Operational Maintenance & Troubleshooting

Your dApp is live, but like any service, it needs monitoring.

#### **Checking the Relayer's Balance**

Your relayer pays for gas, so it needs funds. If it runs out, gasless features will fail.

*   **How to Check:** In your local terminal, run the monitor script:
    ```bash
    npm run monitor:relayer
    ```
*   **What to Do if Low:** If the balance is below the threshold, send more Sepolia ETH to the relayer's address.

#### **Common Deployed App Issues**

*   **Problem:** The "My Wallet" view shows the error `"Etherscan API is not configured for this network."`
    *   **Cause:** You forgot to add the `VITE_ETHERSCAN_API_KEY` to your Vercel project's environment variables.
    *   **Solution:** Go to Vercel -> Your Project -> Settings -> Environment Variables. Add the key and its value. You must then **re-deploy the project** for the change to take effect (`npm run deploy:vercel:prod`).

*   **Problem:** Gasless features are failing.
    *   **Cause:** The relayer wallet is out of Sepolia ETH.
    *   **Solution:** Check the relayer's balance using `npm run monitor:relayer` and send it funds if needed.

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