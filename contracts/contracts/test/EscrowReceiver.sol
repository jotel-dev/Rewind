// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Rewind} from "../Rewind.sol";

/// @notice Test-only buyer/seller: rejects payments or attempts recursive release.
contract EscrowReceiver {
    Rewind private immutable escrow;
    bool private rejectPayment;
    bool private attack;
    uint256 private targetId;
    uint256 private validUntil;
    bytes private signature;

    bool public reentryBlocked;
    uint256 public payments;
    Rewind.State public stateDuringPayment;

    constructor(Rewind escrow_) { escrow = escrow_; }

    function configure(bool reject, bool reenter, uint256 id, uint256 until, bytes calldata sig) external {
        rejectPayment = reject;
        attack = reenter;
        targetId = id;
        validUntil = until;
        signature = sig;
    }

    function create(address seller, bytes32 termsHash, uint64 fulfilBy) external payable returns (uint256) {
        return escrow.createAgreement{value: msg.value}(seller, termsHash, fulfilBy);
    }

    function fulfill(uint256 id) external { escrow.markFulfilled(id); }

    function release(uint256 id, uint256 until, bytes calldata sig) external { escrow.release(id, until, sig); }

    function refund(uint256 id, uint256 until, bytes calldata sig) external { escrow.refund(id, until, sig); }

    receive() external payable {
        if (rejectPayment) revert("test receiver rejects payment");
        ++payments;
        stateDuringPayment = escrow.getAgreement(targetId).state;
        if (attack) {
            try escrow.release(targetId, validUntil, signature) { }
            catch (bytes memory reason) {
                reentryBlocked = bytes4(reason) == Rewind.ReentrantCall.selector;
            }
        }
    }
}
