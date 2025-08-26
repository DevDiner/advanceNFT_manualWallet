const axios = require("axios");
const { keccak256 } = require("js-sha3");
//const { ec: EC } = require("elliptic");
//const rlp = require("rlp");
const {
  Wallet,
  serializeTransaction,
  keccak256,
  toQuantity,
} = require("ethers");

class ManualWallet {
  constructor(privateKey, rpcUrl, chainId) {
    if (!privateKey || !rpcUrl || !chainId) {
      throw new Error("PrivateKey, RPC URL, and ChainID are required.");
    }
    this.rpcUrl = rpcUrl;
    this.chainId = BigInt(chainId);
    // const ec = new EC("secp256k1");
    // this.key = ec.keyFromPrivate(privateKey.replace("0x", ""), "hex");
    // this.address = this._getAddressFromKey(this.key);
    this.wallet = new Wallet(privateKey);
    this.address = this.wallet.address;
    console.log(`Wallet initialized for address: ${this.address}`);
  }

  _getAddressFromKey(key) {
    const pubKey = key.getPublic(false, "hex").slice(2);
    const hash = keccak256(Buffer.from(pubKey, "hex"));
    return "0x" + hash.slice(-40);
  }

  async rpc(method, params = []) {
    try {
      const { data } = await axios.post(this.rpcUrl, {
        jsonrpc: "2.0",
        id: 1,
        method,
        params,
      });
      if (data.error) throw new Error(data.error.message);
      return data.result;
    } catch (err) {
      console.error(`RPC Error [${method}]:`, err.message);
      throw err;
    }
  }

  async getNonce() {
    const nonceHex = await this.rpc("eth_getTransactionCount", [
      this.address,
      "pending",
    ]);
    return BigInt(nonceHex);
  }

  async estimateGas(to, value, data) {
    const gasHex = await this.rpc("eth_estimateGas", [
      { from: this.address, to, value, data },
    ]);
    return BigInt(gasHex);
  }

  async getEIP1559Fees() {
    const block = await this.rpc("eth_getBlockByNumber", ["latest", false]);
    const baseFee = BigInt(block.baseFeePerGas);
    const maxPriorityFeePerGas = 2_000_000_000n; // 2 gwei tip
    const maxFeePerGas = baseFee * 2n + maxPriorityFeePerGas;
    return { maxFeePerGas, maxPriorityFeePerGas };
  }

  async buildAndSendTx(to, valueWei = 0n, data = "0x") {
    const nonce = await this.getNonce();
    const { maxFeePerGas, maxPriorityFeePerGas } = await this.getEIP1559Fees();
    const gasLimit = await this.estimateGas(
      to,
      "0x" + valueWei.toString(16),
      data
    );

    const tx = {
      chainId: this.chainId,
      nonce,
      maxPriorityFeePerGas,
      maxFeePerGas,
      gasLimit,
      to,
      value: valueWei,
      data,
      accessList: [],
      type: 2,
    };

    const unsignedTx = [
      Buffer.from(tx.chainId.toString(16).padStart(2, "0"), "hex"),
      Buffer.from(tx.nonce.toString(16).padStart(2, "0"), "hex"),
      Buffer.from(tx.maxPriorityFeePerGas.toString(16).padStart(2, "0"), "hex"),
      Buffer.from(tx.maxFeePerGas.toString(16).padStart(2, "0"), "hex"),
      Buffer.from(tx.gasLimit.toString(16).padStart(2, "0"), "hex"),
      Buffer.from(tx.to.replace("0x", ""), "hex"),
      Buffer.from(tx.value.toString(16).padStart(2, "0"), "hex"),
      Buffer.from(tx.data.replace("0x", ""), "hex"),
      tx.accessList,
    ];

    const txPayload = Buffer.concat([
      Buffer.from("02", "hex"),
      rlp.encode(unsignedTx),
    ]);
    const hash = Buffer.from(keccak256.arrayBuffer(txPayload));

    const signature = this.key.sign(hash, { canonical: true });

    // For EIP-1559 (type 2) transactions, the recovery param (v) is just 0 or 1.
    // The legacy "+ 27" is not used.
    const signedTx = rlp.encode([
      ...unsignedTx,
      Buffer.from([signature.recoveryParam]),
      signature.r.toArrayLike(Buffer, "be", 32),
      signature.s.toArrayLike(Buffer, "be", 32),
    ]);

    const rawTxHex = "0x02" + signedTx.toString("hex");
    console.log(`Sending Raw TX...`);

    const txHash = await this.rpc("eth_sendRawTransaction", [rawTxHex]);
    console.log("Transaction Hash:", txHash);
    return this.waitForReceipt(txHash);
  }

  async waitForReceipt(txHash) {
    console.log("Waiting for confirmation...");
    while (true) {
      const receipt = await this.rpc("eth_getTransactionReceipt", [txHash]);
      if (receipt) {
        console.log(
          `✅ Transaction confirmed in block: ${parseInt(
            receipt.blockNumber,
            16
          )}`
        );
        return receipt;
      }
      await new Promise((r) => setTimeout(r, 4000));
    }
  }
}

module.exports = { ManualWallet };
