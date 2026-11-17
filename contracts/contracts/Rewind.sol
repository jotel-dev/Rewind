// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IQorePQC} from "./interfaces/IQorePQC.sol";

/// @title Rewind
/// @notice Native-asset escrow with buyer-authorized ML-DSA-87 settlement.
/// @dev EVM window authorization is separate from the per-agreement signature
/// verified here. A fulfilled agreement has no unilateral timeout refund.
contract Rewind {
    enum State { None, Funded, Fulfilled, Released, Refunded }

    struct Agreement {
        address buyer;
        address seller;
        uint256 amount;
        bytes32 termsHash;
        uint64 fulfilBy;
        State state;
    }

    error ZeroAmount();
    error InvalidSeller();
    error InvalidDeadline();
    error AgreementNotFound();
    error OnlyBuyer();
    error OnlySeller();
    error InvalidState();
    error FulfilmentDeadlinePassed();
    error RefundNotAvailable();
    error AuthorizationExpired();
    error PqcKeyNotRegistered();
    error PqcPossessionNotProven();
    error UnsupportedPqcAlgorithm();
    error InvalidPqcPublicKey();
    error InvalidPqcSignature();
    error InvalidAction();
    error PaymentFailed();
    error ReentrantCall();

    event AgreementCreated(
        uint256 indexed id, address indexed buyer, address indexed seller,
        uint256 amount, bytes32 termsHash, uint64 fulfilBy
    );
    event AgreementFulfilled(uint256 indexed id);
    event AgreementReleased(uint256 indexed id, address indexed seller, uint256 amount);
    event AgreementRefunded(uint256 indexed id, address indexed buyer, uint256 amount);

    IQorePQC private constant PQC_VERIFY = IQorePQC(0x0000000000000000000000000000000000000a01);
    IQorePQC private constant PQC_STATUS = IQorePQC(0x0000000000000000000000000000000000000a02);
    uint8 private constant RELEASE = 1;
    uint8 private constant REFUND = 2;

    mapping(uint256 => Agreement) private agreements;
    uint256 private nextId = 1;
    bool private entered;

    modifier nonReentrant() {
        if (entered) revert ReentrantCall();
        entered = true;
        _;
        entered = false;
    }

    function createAgreement(address seller, bytes32 termsHash, uint64 fulfilBy)
        external payable nonReentrant returns (uint256 id)
    {
        if (msg.value == 0) revert ZeroAmount();
        if (seller == address(0) || seller == msg.sender) revert InvalidSeller();
        if (fulfilBy <= block.timestamp) revert InvalidDeadline();

        id = nextId++;
        agreements[id] = Agreement(msg.sender, seller, msg.value, termsHash, fulfilBy, State.Funded);
        emit AgreementCreated(id, msg.sender, seller, msg.value, termsHash, fulfilBy);
    }

    function markFulfilled(uint256 id) external nonReentrant {
        Agreement storage agreement = _agreement(id);
        if (msg.sender != agreement.seller) revert OnlySeller();
        if (agreement.state != State.Funded) revert InvalidState();
        if (block.timestamp >= agreement.fulfilBy) revert FulfilmentDeadlinePassed();

        agreement.state = State.Fulfilled;
        emit AgreementFulfilled(id);
    }

    function release(uint256 id, uint256 validUntil, bytes calldata pqSignature) external nonReentrant {
        Agreement storage agreement = _agreement(id);
        if (msg.sender != agreement.buyer) revert OnlyBuyer();
        if (agreement.state != State.Fulfilled) revert InvalidState();
        _authorize(agreement, id, RELEASE, validUntil, pqSignature);

        agreement.state = State.Released;
        (bool success,) = agreement.seller.call{value: agreement.amount}("");
        if (!success) revert PaymentFailed();
        emit AgreementReleased(id, agreement.seller, agreement.amount);
    }

    function refund(uint256 id, uint256 validUntil, bytes calldata pqSignature) external nonReentrant {
        Agreement storage agreement = _agreement(id);
        if (msg.sender != agreement.buyer) revert OnlyBuyer();
        if (agreement.state != State.Funded) revert InvalidState();
        if (block.timestamp <= agreement.fulfilBy) revert RefundNotAvailable();
        _authorize(agreement, id, REFUND, validUntil, pqSignature);

        agreement.state = State.Refunded;
        (bool success,) = agreement.buyer.call{value: agreement.amount}("");
        if (!success) revert PaymentFailed();
        emit AgreementRefunded(id, agreement.buyer, agreement.amount);
    }

    function getAgreement(uint256 id) external view returns (Agreement memory) {
        return _agreement(id);
    }

    /// @notice State/deadline eligibility; the buyer still needs valid PQC authorization.
    function isRefundable(uint256 id) external view returns (bool) {
        Agreement storage agreement = _agreement(id);
        return agreement.state == State.Funded && block.timestamp > agreement.fulfilBy;
    }

    /// @notice Sign these exact 32 bytes with ML-DSA-87, without an Ethereum prefix.
    /// @dev action is uint8: 1 = release, 2 = refund; validUntil is uint256.
    function digestFor(uint256 id, uint8 action, uint256 validUntil) external view returns (bytes32) {
        if (action != RELEASE && action != REFUND) revert InvalidAction();
        return _digest(_agreement(id), id, action, validUntil);
    }

    function _agreement(uint256 id) private view returns (Agreement storage agreement) {
        agreement = agreements[id];
        if (agreement.state == State.None) revert AgreementNotFound();
    }

    function _digest(Agreement storage agreement, uint256 id, uint8 action, uint256 validUntil)
        private view returns (bytes32)
    {
        return keccak256(abi.encode(
            "REWIND_V1", block.chainid, address(this), id, action,
            agreement.buyer, agreement.seller, agreement.amount, agreement.termsHash, validUntil
        ));
    }

    function _authorize(
        Agreement storage agreement, uint256 id, uint8 action, uint256 validUntil, bytes calldata pqSignature
    ) private view {
        if (block.timestamp > validUntil) revert AuthorizationExpired();
        (bool registered, uint8 algorithmId, bytes memory pubkey, bool possessionProven) =
            PQC_STATUS.pqcKeyStatus(agreement.buyer);
        if (!registered) revert PqcKeyNotRegistered();
        if (!possessionProven) revert PqcPossessionNotProven();
        if (algorithmId != 1) revert UnsupportedPqcAlgorithm();
        if (pubkey.length != 2592) revert InvalidPqcPublicKey();
        if (pqSignature.length != 4627) revert InvalidPqcSignature();
        bytes memory message = abi.encodePacked(_digest(agreement, id, action, validUntil));
        if (!PQC_VERIFY.pqcVerify(pubkey, pqSignature, message)) revert InvalidPqcSignature();
    }
}
