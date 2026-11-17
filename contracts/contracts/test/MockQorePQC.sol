// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IQorePQC} from "../interfaces/IQorePQC.sol";

/// @notice TEST DOUBLE ONLY: this is not real cryptography or authentication.
/// @dev No constructor or storage: runtime bytecode can be etched at both
/// precompile addresses. A fake public key repeats keccak256(abi.encodePacked(account))
/// 81 times. Accounts ending in 0xff simulate an unregistered key. A fake
/// signature's first 32 bytes must equal keccak256(abi.encodePacked(pubkey, message)).
/// Anyone can forge this scheme; the tests establish escrow logic, not ML-DSA security.
contract MockQorePQC is IQorePQC {
    function pqcKeyStatus(address account)
        external pure returns (bool registered, uint8 algorithmId, bytes memory pubkey, bool possessionProven)
    {
        if (uint8(uint160(account)) == 0xff) return (false, 0, new bytes(0), false);
        bytes32 seed = keccak256(abi.encodePacked(account));
        pubkey = new bytes(2592);
        for (uint256 i; i < pubkey.length; ++i) pubkey[i] = seed[i % 32];
        return (true, 1, pubkey, true);
    }

    function pqcVerify(bytes calldata pubkey, bytes calldata signature, bytes calldata message)
        external pure returns (bool valid)
    {
        if (signature.length < 32) return false;
        bytes32 prefix;
        assembly ("memory-safe") { prefix := calldataload(signature.offset) }
        return prefix == keccak256(abi.encodePacked(pubkey, message));
    }
}
