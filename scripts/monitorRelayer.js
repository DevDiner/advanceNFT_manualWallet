// SCRIPT: RELAYER WALLET MONITOR
// ================================
// This script is an operational tool to ensure the meta-transaction relayer does not
// run out of funds for paying gas fees. It checks the relayer's wallet balance
// against a configurable threshold and logs a clear warning if it's too low.
//
// In a production environment, this script would be automated to run on a schedule
// (e.g., every hour via a cron job) and would be integrated with an alerting system
// (like PagerDuty, Slack, or email) to notify the development team.

const hre = require("hardhat");
require("dotenv").config();

// --- Configuration ---
// The balance threshold in ETH. If the relayer's balance falls below this,
// a warning will be triggered.
const THRESHOLD_ETH = "0.5";
// -------------------

async function main() {
  console.log("--- Relayer Wallet Balance Monitor ---");

  const relayerPrivateKey = process.env.RELAYER_PRIVATE_KEY;
  if (!relayerPrivateKey) {
    console.error("❌ ERROR: RELAYER_PRIVATE_KEY is not set in the .env file.");
    console.error(
      "   Please set it to the private key of the wallet you want to monitor."
    );
    process.exit(1);
  }

  const provider = hre.ethers.provider;
  const relayerWallet = new hre.ethers.Wallet(relayerPrivateKey, provider);
  const network = await provider.getNetwork();

  console.log(
    `- Monitoring Network: ${network.name} (Chain ID: ${network.chainId})`
  );
  console.log(`- Relayer Wallet Address: ${relayerWallet.address}`);
  console.log(`- Alert Threshold: ${THRESHOLD_ETH} ETH`);
  console.log("--------------------------------------\n");

  try {
    console.log("Fetching current balance...");
    const balanceWei = await provider.getBalance(relayerWallet.address);
    const balanceEth = hre.ethers.formatEther(balanceWei);

    console.log(`   Current Balance: ${parseFloat(balanceEth).toFixed(6)} ETH`);

    const threshold = hre.ethers.parseEther(THRESHOLD_ETH);

    if (balanceWei < threshold) {
      console.log(
        "\n\n=========================================================="
      );
      console.log("  🚨 !!! WARNING: RELAYER WALLET BALANCE IS LOW !!! 🚨");
      console.log("==========================================================");
      console.log(
        `  Current balance (${balanceEth} ETH) is below the threshold of ${THRESHOLD_ETH} ETH.`
      );
      console.log(
        `  Please fund the relayer wallet at: ${relayerWallet.address}`
      );
      console.log(
        "  Meta-transactions may fail if the wallet runs out of gas."
      );
      console.log("==========================================================");
    } else {
      console.log("\n✅  Relayer wallet balance is sufficient.");
    }
  } catch (error) {
    console.error("\n❌ An error occurred while fetching the wallet balance:");
    console.error(error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
