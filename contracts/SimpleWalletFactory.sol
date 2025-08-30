// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./SimpleWallet.sol";

/// @notice Minimal factory that deploys & tracks one Smart Wallet per EOA.
contract SimpleWalletFactory {
    event WalletCreated(address indexed owner, address indexed wallet);

    mapping(address => address) public walletOf;

    function hasWallet(address owner) external view returns (bool) {
        return walletOf[owner] != address(0);
    }

    /// @dev Anyone can request creation for `owner`. Your relayer calls this and pays gas.
    function createWallet(address owner) external returns (address wallet) {
        require(owner != address(0), "owner=0");
        require(walletOf[owner] == address(0), "exists");
        wallet = address(new SimpleWallet(owner));
        walletOf[owner] = wallet;
        emit WalletCreated(owner, wallet);
    }
}
