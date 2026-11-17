// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice QoreChain PQC precompiles: verification at 0x0A01, key status at 0x0A02.
/// @dev The installed @qorechain/evm 0.14.0 ABI has only three pqcKeyStatus
/// outputs. This four-output form follows the official QoreChain docs and must
/// still be confirmed on testnet: https://docs.qorechain.io/developer-guide/evm-precompiles/
interface IQorePQC {
    function pqcVerify(bytes calldata pubkey, bytes calldata signature, bytes calldata message)
        external view returns (bool valid);

    function pqcKeyStatus(address account)
        external view returns (bool registered, uint8 algorithmId, bytes memory pubkey, bool possessionProven);
}
