// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";

/// @notice Meta-transaction wallet that can hold ETH / ERC20 / ERC721 / ERC1155
/// and execute arbitrary calls via EIP-712. Includes ERC20 admin helpers.
contract SimpleWallet is EIP712, IERC721Receiver, IERC1155Receiver, ERC165, Ownable {
    using ECDSA for bytes32;
    using SafeERC20 for IERC20;

    /// @dev Per-signer nonce (prevents replay)
    mapping(address => uint256) public nonces;

    /// @dev Additional addresses allowed to sign meta-txs (besides Ownable.owner()).
    mapping(address => bool) public isOwner;

    bytes32 private constant META_TX_TYPEHASH =
        keccak256("MetaTransaction(address from,uint256 nonce,address to,uint256 value,bytes data)");

    event OwnerAdded(address indexed newOwner);
    event OwnerRemoved(address indexed removedOwner);
    event MetaTransactionExecuted(address indexed user, address indexed to, uint256 value, bytes data);

    // ERC20 helper events
    event ERC20Transferred(address indexed token, address indexed to, uint256 amount);
    event ERC20Approved(address indexed token, address indexed spender, uint256 amount);
    event ERC20Pulled(address indexed token, address indexed from, address indexed to, uint256 amount);

    /// @param initialOwner Admin owner for Ownable; also authorized for meta-tx.
    constructor(address initialOwner) EIP712("SimpleWallet", "1") Ownable(initialOwner) {
        require(initialOwner != address(0), "Initial owner is zero");
        isOwner[initialOwner] = true;
    }

    /*  Admin: manage signers  */
    function addOwner(address a) external onlyOwner {
        require(a != address(0), "zero address");
        isOwner[a] = true;
        emit OwnerAdded(a);
    }

    function removeOwner(address a) external onlyOwner {
        require(a != owner(), "cannot remove contract owner");
        isOwner[a] = false;
        emit OwnerRemoved(a);
    }

    /*  EIP-712 meta-transaction core  */
    /// @notice Execute a meta-transaction authorized by `from`.
    /// @dev Call is executed FROM this contract; relayer only pays gas.
    function executeMetaTransaction(
        address from,
        address to,
        uint256 value,
        bytes calldata data,
        bytes calldata signature
    ) external payable returns (bytes memory) {
        require(isOwner[from] || from == owner(), "unauthorized signer");

        bytes32 structHash =
            keccak256(abi.encode(META_TX_TYPEHASH, from, nonces[from], to, value, keccak256(data)));
        bytes32 digest = _hashTypedDataV4(structHash);
        require(digest.recover(signature) == from, "Invalid signature");

        unchecked { ++nonces[from]; }

        // forward ETH along with the call so mintPrice is paid.
        (bool ok, bytes memory ret) = to.call{value: value}(data);
        require(ok, "Meta-transaction call failed");

        emit MetaTransactionExecuted(from, to, value, data);
        return ret;
    }

    /*  ERC20 admin helpers  */
    function erc20Transfer(address token, address to, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
        emit ERC20Transferred(token, to, amount);
    }

    function erc20Approve(address token, address spender, uint256 amount) external onlyOwner {
        IERC20(token).forceApprove(spender, 0);
        IERC20(token).forceApprove(spender, amount);
        emit ERC20Approved(token, spender, amount);
    }

    function erc20TransferFrom(address token, address from, address to, uint256 amount) external onlyOwner {
        IERC20(token).safeTransferFrom(from, to, amount);
        emit ERC20Pulled(token, from, to, amount);
    }

    /*  Receive ETH / 721 / 1155 hooks  */
    receive() external payable {}

    function onERC721Received(address, address, uint256, bytes calldata)
        external pure override returns (bytes4)
    { return this.onERC721Received.selector; }

    function onERC1155Received(address, address, uint256, uint256, bytes calldata)
        external pure override returns (bytes4)
    { return this.onERC1155Received.selector; }

    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata)
        external pure override returns (bytes4)
    { return this.onERC1155BatchReceived.selector; }

    /*  ERC165  */
    function supportsInterface(bytes4 interfaceId)
        public view override(ERC165, IERC165)
        returns (bool)
    {
        return
            interfaceId == type(IERC721Receiver).interfaceId ||
            interfaceId == type(IERC1155Receiver).interfaceId ||
            super.supportsInterface(interfaceId);
    }
}
