import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { artifacts, network } from "hardhat";
import {
  concatHex, encodeAbiParameters, encodePacked, getAddress, keccak256,
  parseAbiParameters, parseEther, parseEventLogs, toHex, zeroAddress,
  type Address, type Hex,
} from "viem";

const VERIFY: Address = "0x0000000000000000000000000000000000000a01";
const STATUS: Address = "0x0000000000000000000000000000000000000a02";
const NO_KEY: Address = "0x00000000000000000000000000000000000012ff";
const AMOUNT = parseEther("1");
const TERMS = keccak256(toHex("Rewind test agreement"));
const State = { None: 0, Funded: 1, Fulfilled: 2, Released: 3, Refunded: 4 } as const;

// This signature is deliberately forgeable. It exercises escrow authorization
// plumbing only; it does NOT test ML-DSA-87 or real QoreChain precompiles.
function mockPublicKey(account: Address): Hex {
  const seed = keccak256(encodePacked(["address"], [account]));
  return `0x${seed.slice(2).repeat(81)}`;
}

function mockSignature(account: Address, message: Hex): Hex {
  const prefix = keccak256(concatHex([mockPublicKey(account), message]));
  return `0x${prefix.slice(2)}${"00".repeat(4627 - 32)}`;
}

// Test-only runtime that returns fixed ABI data, for malformed key metadata.
// PUSH2 len; PUSH2 15; PUSH1 0; CODECOPY; PUSH2 len; PUSH1 0; RETURN; data.
function constantReturnCode(data: Hex): Hex {
  const length = toHex((data.length - 2) / 2, { size: 2 });
  return concatHex(["0x61", length, "0x61000f60003961", length, "0x6000f3", data]);
}

describe("Rewind", async () => {
  const { viem, networkHelpers } = await network.create();
  const client = await viem.getPublicClient();
  const [buyer, seller, stranger] = await viem.getWalletClients();

  async function fixture() {
    const mockArtifact = await artifacts.readArtifact("MockQorePQC");
    // networkHelpers.setCode uses hardhat_setCode on this simulated network.
    await networkHelpers.setCode(VERIFY, mockArtifact.deployedBytecode);
    await networkHelpers.setCode(STATUS, mockArtifact.deployedBytecode);
    const rewind = await viem.deployContract("Rewind");
    const status = await viem.getContractAt("MockQorePQC", STATUS);
    const verifier = await viem.getContractAt("MockQorePQC", VERIFY);
    const now = () => networkHelpers.time.latest().then(BigInt);

    async function create(options: {
      from?: Address; to?: Address; amount?: bigint; terms?: Hex; deadline?: bigint;
    } = {}) {
      const from = options.from ?? buyer.account.address;
      const to = options.to ?? seller.account.address;
      const amount = options.amount ?? AMOUNT;
      const terms = options.terms ?? TERMS;
      const fulfilBy = options.deadline ?? (await now()) + 3600n;
      const args = [to, terms, fulfilBy] as const;
      const { result: id } = await rewind.simulate.createAgreement(args, { account: from, value: amount });
      const hash = await rewind.write.createAgreement(args, { account: from, value: amount });
      const receipt = await client.waitForTransactionReceipt({ hash });
      return { id, fulfilBy, receipt };
    }

    async function authorize(id: bigint, action: number, until: bigint, account = buyer.account.address) {
      const digest = await rewind.read.digestFor([id, action, until]);
      return mockSignature(account, digest);
    }

    async function fulfilled() {
      const agreement = await create();
      await rewind.write.markFulfilled([agreement.id], { account: seller.account });
      const validUntil = agreement.fulfilBy + 600n;
      const signature = await authorize(agreement.id, 1, validUntil);
      return { ...agreement, validUntil, signature };
    }

    return { rewind, status, verifier, now, create, authorize, fulfilled };
  }

  const setup = () => networkHelpers.loadFixture(fixture);

  it("creates, funds, returns an ID, stores all fields, and emits the creation event", async () => {
    const { rewind, create } = await setup();
    const sellerBefore = await client.getBalance({ address: seller.account.address });
    const { id, fulfilBy, receipt } = await create();
    assert.equal(id, 1n);
    assert.deepEqual(await rewind.read.getAgreement([id]), {
      buyer: getAddress(buyer.account.address), seller: getAddress(seller.account.address),
      amount: AMOUNT, termsHash: TERMS, fulfilBy, state: State.Funded,
    });
    assert.equal(await client.getBalance({ address: rewind.address }), AMOUNT);
    assert.equal(await client.getBalance({ address: seller.account.address }), sellerBefore);
    const [event] = parseEventLogs({ abi: rewind.abi, logs: receipt.logs, eventName: "AgreementCreated" });
    assert.deepEqual(event.args, {
      id, buyer: getAddress(buyer.account.address), seller: getAddress(seller.account.address),
      amount: AMOUNT, termsHash: TERMS, fulfilBy,
    });
  });

  for (const [label, error] of [
    ["zero value", "ZeroAmount"], ["zero seller", "InvalidSeller"],
    ["buyer as seller", "InvalidSeller"], ["past deadline", "InvalidDeadline"],
  ] as const) {
    it(`rejects creation with ${label}`, async () => {
      const { rewind, now } = await setup();
      const to = label === "zero seller" ? zeroAddress : label === "buyer as seller" ? buyer.account.address : seller.account.address;
      await viem.assertions.revertWithCustomError(
        rewind.write.createAgreement([to, TERMS, (await now()) + (label === "past deadline" ? -1n : 3600n)], {
          value: label === "zero value" ? 0n : AMOUNT,
        }), rewind, error,
      );
      assert.equal(await client.getBalance({ address: rewind.address }), 0n);
    });
  }

  it("rejects creation when fulfilBy equals the executing block timestamp", async () => {
    const { rewind, now } = await setup();
    const deadline = (await now()) + 10n;
    await networkHelpers.time.setNextBlockTimestamp(deadline);
    await viem.assertions.revertWithCustomError(
      rewind.write.createAgreement([seller.account.address, TERMS, deadline], { value: AMOUNT, gas: 500_000n }),
      rewind, "InvalidDeadline",
    );
  });

  for (const method of ["getAgreement", "isRefundable", "digestFor", "markFulfilled", "release", "refund"] as const) {
    it(`${method} rejects an unknown agreement`, async () => {
      const { rewind } = await setup();
      const call = method === "getAgreement" ? rewind.read.getAgreement([999n])
        : method === "isRefundable" ? rewind.read.isRefundable([999n])
        : method === "digestFor" ? rewind.read.digestFor([999n, 1, 100n])
        : method === "markFulfilled" ? rewind.write.markFulfilled([999n])
        : method === "release" ? rewind.write.release([999n, 100n, "0x"])
        : rewind.write.refund([999n, 100n, "0x"]);
      await viem.assertions.revertWithCustomError(call, rewind, "AgreementNotFound");
    });
  }

  it("reserves ID zero for None", async () => {
    const { rewind } = await setup();
    await viem.assertions.revertWithCustomError(rewind.read.getAgreement([0n]), rewind, "AgreementNotFound");
  });

  it("only lets the seller mark fulfillment, and emits its event", async () => {
    const { rewind, create } = await setup();
    const { id } = await create();
    await viem.assertions.emitWithArgs(rewind.write.markFulfilled([id], { account: seller.account }), rewind, "AgreementFulfilled", [id]);
    assert.equal((await rewind.read.getAgreement([id])).state, State.Fulfilled);
    assert.equal(await client.getBalance({ address: rewind.address }), AMOUNT);
  });

  for (const actor of [buyer, stranger]) {
    it(`rejects fulfillment by ${actor === buyer ? "buyer" : "stranger"}`, async () => {
      const { rewind, create } = await setup();
      const { id } = await create();
      await viem.assertions.revertWithCustomError(rewind.write.markFulfilled([id], { account: actor.account }), rewind, "OnlySeller");
    });
  }

  for (const offset of [0n, 1n]) {
    it(`rejects fulfillment ${offset === 0n ? "at" : "after"} the deadline`, async () => {
      const { rewind, create } = await setup();
      const { id, fulfilBy } = await create();
      await networkHelpers.time.setNextBlockTimestamp(fulfilBy + offset);
      await viem.assertions.revertWithCustomError(
        rewind.write.markFulfilled([id], { account: seller.account, gas: 500_000n }), rewind, "FulfilmentDeadlinePassed",
      );
    });
  }

  it("rejects repeated fulfillment", async () => {
    const { rewind, fulfilled } = await setup();
    const { id } = await fulfilled();
    await viem.assertions.revertWithCustomError(rewind.write.markFulfilled([id], { account: seller.account }), rewind, "InvalidState");
  });

  it("releases exactly the agreement amount to the stored seller and emits its event", async () => {
    const { rewind, fulfilled } = await setup();
    const { id, validUntil, signature } = await fulfilled();
    const sellerBefore = await client.getBalance({ address: seller.account.address });
    const buyerBefore = await client.getBalance({ address: buyer.account.address });
    const hash = await rewind.write.release([id, validUntil, signature]);
    const receipt = await client.waitForTransactionReceipt({ hash });
    assert.equal(receipt.status, "success");
    assert.equal((await rewind.read.getAgreement([id])).state, State.Released);
    assert.equal(await client.getBalance({ address: rewind.address }), 0n);
    assert.equal(await client.getBalance({ address: seller.account.address }), sellerBefore + AMOUNT);
    assert.equal(await client.getBalance({ address: buyer.account.address }), buyerBefore - receipt.gasUsed * receipt.effectiveGasPrice);
    const [event] = parseEventLogs({ abi: rewind.abi, logs: receipt.logs, eventName: "AgreementReleased" });
    assert.deepEqual(event.args, { id, seller: getAddress(seller.account.address), amount: AMOUNT });
    assert.equal(await rewind.read.isRefundable([id]), false);
  });

  for (const actor of [seller, stranger]) {
    it(`rejects release by ${actor === seller ? "seller (no early withdrawal)" : "stranger"}`, async () => {
      const { rewind, fulfilled } = await setup();
      const { id, validUntil, signature } = await fulfilled();
      await viem.assertions.revertWithCustomError(rewind.write.release([id, validUntil, signature], { account: actor.account }), rewind, "OnlyBuyer");
      assert.equal(await client.getBalance({ address: rewind.address }), AMOUNT);
    });
  }

  it("rejects release before fulfillment", async () => {
    const { rewind, create, authorize } = await setup();
    const { id, fulfilBy } = await create();
    await viem.assertions.revertWithCustomError(rewind.write.release([id, fulfilBy, await authorize(id, 1, fulfilBy)]), rewind, "InvalidState");
  });

  it("rejects an invalid release signature without changing funds or state", async () => {
    const { rewind, fulfilled } = await setup();
    const { id, validUntil } = await fulfilled();
    await viem.assertions.revertWithCustomError(rewind.write.release([id, validUntil, `0x${"00".repeat(4627)}`]), rewind, "InvalidPqcSignature");
    assert.equal((await rewind.read.getAgreement([id])).state, State.Fulfilled);
    assert.equal(await client.getBalance({ address: rewind.address }), AMOUNT);
  });

  for (const length of [0, 31, 4626, 4628]) {
    it(`rejects a ${length}-byte release signature`, async () => {
      const { rewind, fulfilled } = await setup();
      const { id, validUntil } = await fulfilled();
      await viem.assertions.revertWithCustomError(rewind.write.release([id, validUntil, `0x${"00".repeat(length)}`]), rewind, "InvalidPqcSignature");
    });
  }

  it("rejects an expired release authorization", async () => {
    const { rewind, fulfilled, authorize, now } = await setup();
    const { id } = await fulfilled();
    const expired = (await now()) - 1n;
    await viem.assertions.revertWithCustomError(rewind.write.release([id, expired, await authorize(id, 1, expired)]), rewind, "AuthorizationExpired");
  });

  it("accepts release exactly at validUntil", async () => {
    const { rewind, fulfilled, authorize, now } = await setup();
    const { id } = await fulfilled();
    const until = (await now()) + 10n;
    const sig = await authorize(id, 1, until);
    await networkHelpers.time.setNextBlockTimestamp(until);
    await rewind.write.release([id, until, sig], { gas: 5_000_000n });
    assert.equal((await rewind.read.getAgreement([id])).state, State.Released);
  });

  it("allows a fulfilled agreement to release after fulfilBy", async () => {
    const { rewind, fulfilled } = await setup();
    const { id, fulfilBy, validUntil, signature } = await fulfilled();
    await networkHelpers.time.increaseTo(fulfilBy + 1n);
    await rewind.write.release([id, validUntil, signature]);
    assert.equal((await rewind.read.getAgreement([id])).state, State.Released);
  });

  it("rejects double release and fulfillment after release", async () => {
    const { rewind, fulfilled } = await setup();
    const { id, validUntil, signature } = await fulfilled();
    await rewind.write.release([id, validUntil, signature]);
    await viem.assertions.revertWithCustomError(rewind.write.release([id, validUntil, signature]), rewind, "InvalidState");
    await viem.assertions.revertWithCustomError(rewind.write.markFulfilled([id], { account: seller.account }), rewind, "InvalidState");
    assert.equal(await client.getBalance({ address: rewind.address }), 0n);
  });

  it("rejects release for a buyer without a registered PQC key", async () => {
    const { rewind, create, authorize } = await setup();
    await networkHelpers.impersonateAccount(NO_KEY);
    await networkHelpers.setBalance(NO_KEY, parseEther("10"));
    const { id, fulfilBy } = await create({ from: NO_KEY });
    await rewind.write.markFulfilled([id], { account: seller.account });
    await viem.assertions.revertWithCustomError(
      rewind.write.release([id, fulfilBy, await authorize(id, 1, fulfilBy, NO_KEY)], { account: NO_KEY }), rewind, "PqcKeyNotRegistered",
    );
    await networkHelpers.stopImpersonatingAccount(NO_KEY);
  });

  for (const [label, algorithm, keyLength, proven, error] of [
    ["unproven possession", 1, 2592, false, "PqcPossessionNotProven"],
    ["unsupported algorithm", 2, 2592, true, "UnsupportedPqcAlgorithm"],
    ["malformed public key", 1, 2591, true, "InvalidPqcPublicKey"],
  ] as const) {
    it(`rejects release with ${label}`, async () => {
      const { rewind, fulfilled } = await setup();
      const { id, validUntil, signature } = await fulfilled();
      const response = encodeAbiParameters(parseAbiParameters("bool,uint8,bytes,bool"), [true, algorithm, `0x${"01".repeat(keyLength)}`, proven]);
      await networkHelpers.setCode(STATUS, constantReturnCode(response));
      await viem.assertions.revertWithCustomError(rewind.write.release([id, validUntil, signature]), rewind, error);
    });
  }

  for (const address of [STATUS, VERIFY]) {
    it(`fails closed when the ${address === STATUS ? "status" : "verify"} precompile is absent`, async () => {
      const { rewind, fulfilled } = await setup();
      const { id, validUntil, signature } = await fulfilled();
      await networkHelpers.setCode(address, "0x");
      await viem.assertions.revert(rewind.write.release([id, validUntil, signature]));
      assert.equal((await rewind.read.getAgreement([id])).state, State.Fulfilled);
    });
  }

  it("fails closed for a legacy three-output key-status response", async () => {
    const { rewind, fulfilled } = await setup();
    const { id, validUntil, signature } = await fulfilled();
    const legacy = encodeAbiParameters(parseAbiParameters("bool,uint8,bytes"), [true, 1, mockPublicKey(buyer.account.address)]);
    await networkHelpers.setCode(STATUS, constantReturnCode(legacy));
    await viem.assertions.revert(rewind.write.release([id, validUntil, signature]));
  });

  it("reconstructs the exact digest independently for both actions", async () => {
    const { rewind, create } = await setup();
    const { id, fulfilBy } = await create();
    for (const action of [1, 2]) {
      const expected = keccak256(encodeAbiParameters(
        parseAbiParameters("string,uint256,address,uint256,uint8,address,address,uint256,bytes32,uint256"),
        ["REWIND_V1", BigInt(await client.getChainId()), rewind.address, id, action,
          buyer.account.address, seller.account.address, AMOUNT, TERMS, fulfilBy],
      ));
      assert.equal(await rewind.read.digestFor([id, action, fulfilBy]), expected);
    }
  });

  for (const action of [0, 3]) {
    it(`rejects undefined digest action ${action}`, async () => {
      const { rewind, create } = await setup();
      const { id, fulfilBy } = await create();
      await viem.assertions.revertWithCustomError(rewind.read.digestFor([id, action, fulfilBy]), rewind, "InvalidAction");
    });
  }

  for (const mismatch of ["buyer key", "action", "validUntil", "agreement", "contract", "chain", "amount", "terms", "seller", "buyer"] as const) {
    it(`rejects release authorization bound to a different ${mismatch}`, async () => {
      const { rewind, fulfilled, authorize, create } = await setup();
      const { id, validUntil } = await fulfilled();
      let sig: Hex;
      if (mismatch === "buyer key") sig = await authorize(id, 1, validUntil, stranger.account.address);
      else if (mismatch === "action") sig = await authorize(id, 2, validUntil);
      else if (mismatch === "validUntil") sig = await authorize(id, 1, validUntil + 1n);
      else if (mismatch === "agreement") sig = await authorize((await create()).id, 1, validUntil);
      else {
        const digest = keccak256(encodeAbiParameters(
          parseAbiParameters("string,uint256,address,uint256,uint8,address,address,uint256,bytes32,uint256"),
          ["REWIND_V1", BigInt(await client.getChainId()) + (mismatch === "chain" ? 1n : 0n),
            mismatch === "contract" ? stranger.account.address : rewind.address, id, 1,
            mismatch === "buyer" ? stranger.account.address : buyer.account.address,
            mismatch === "seller" ? stranger.account.address : seller.account.address,
            mismatch === "amount" ? AMOUNT + 1n : AMOUNT,
            mismatch === "terms" ? keccak256(toHex("other terms")) : TERMS, validUntil],
        ));
        sig = mockSignature(buyer.account.address, digest);
      }
      await viem.assertions.revertWithCustomError(rewind.write.release([id, validUntil, sig]), rewind, "InvalidPqcSignature");
    });
  }

  it("reports refund eligibility before, at, and after the deadline", async () => {
    const { rewind, create } = await setup();
    const { id, fulfilBy } = await create();
    assert.equal(await rewind.read.isRefundable([id]), false);
    await networkHelpers.time.increaseTo(fulfilBy);
    assert.equal(await rewind.read.isRefundable([id]), false);
    await networkHelpers.time.increaseTo(fulfilBy + 1n);
    assert.equal(await rewind.read.isRefundable([id]), true);
  });

  for (const atDeadline of [false, true]) {
    it(`rejects refund ${atDeadline ? "at" : "before"} fulfilBy`, async () => {
      const { rewind, create, authorize } = await setup();
      const { id, fulfilBy } = await create();
      const until = fulfilBy + 600n;
      const sig = await authorize(id, 2, until);
      if (atDeadline) await networkHelpers.time.setNextBlockTimestamp(fulfilBy);
      await viem.assertions.revertWithCustomError(rewind.write.refund([id, until, sig], { gas: 5_000_000n }), rewind, "RefundNotAvailable");
    });
  }

  it("refunds exactly the stored buyer after the deadline, accounting for gas and emitting its event", async () => {
    const { rewind, create, authorize } = await setup();
    const { id, fulfilBy } = await create();
    await networkHelpers.time.increaseTo(fulfilBy + 1n);
    const until = fulfilBy + 600n;
    const sig = await authorize(id, 2, until);
    const buyerBefore = await client.getBalance({ address: buyer.account.address });
    const sellerBefore = await client.getBalance({ address: seller.account.address });
    const hash = await rewind.write.refund([id, until, sig]);
    const receipt = await client.waitForTransactionReceipt({ hash });
    assert.equal(await client.getBalance({ address: buyer.account.address }), buyerBefore + AMOUNT - receipt.gasUsed * receipt.effectiveGasPrice);
    assert.equal(await client.getBalance({ address: seller.account.address }), sellerBefore);
    assert.equal(await client.getBalance({ address: rewind.address }), 0n);
    assert.equal((await rewind.read.getAgreement([id])).state, State.Refunded);
    assert.equal(await rewind.read.isRefundable([id]), false);
    const [event] = parseEventLogs({ abi: rewind.abi, logs: receipt.logs, eventName: "AgreementRefunded" });
    assert.deepEqual(event.args, { id, buyer: getAddress(buyer.account.address), amount: AMOUNT });
  });

  for (const invalid of ["signature", "expired", "release action"] as const) {
    it(`rejects refund with ${invalid} authorization`, async () => {
      const { rewind, create, authorize, now } = await setup();
      const { id, fulfilBy } = await create();
      await networkHelpers.time.increaseTo(fulfilBy + 1n);
      const until = invalid === "expired" ? (await now()) - 1n : fulfilBy + 600n;
      const sig = invalid === "signature" ? `0x${"00".repeat(4627)}` as Hex : await authorize(id, invalid === "release action" ? 1 : 2, until);
      await viem.assertions.revertWithCustomError(rewind.write.refund([id, until, sig]), rewind, invalid === "expired" ? "AuthorizationExpired" : "InvalidPqcSignature");
      assert.equal((await rewind.read.getAgreement([id])).state, State.Funded);
      assert.equal(await client.getBalance({ address: rewind.address }), AMOUNT);
    });
  }

  for (const actor of [seller, stranger]) {
    it(`rejects refund by ${actor === seller ? "seller" : "stranger"}`, async () => {
      const { rewind, create, authorize } = await setup();
      const { id, fulfilBy } = await create();
      await networkHelpers.time.increaseTo(fulfilBy + 1n);
      const until = fulfilBy + 600n;
      await viem.assertions.revertWithCustomError(rewind.write.refund([id, until, await authorize(id, 2, until)], { account: actor.account }), rewind, "OnlyBuyer");
    });
  }

  for (const state of ["fulfilled", "released", "refunded"] as const) {
    it(`rejects refund after ${state}`, async () => {
      const { rewind, create, authorize } = await setup();
      const { id, fulfilBy } = await create();
      const until = fulfilBy + 600n;
      if (state !== "refunded") await rewind.write.markFulfilled([id], { account: seller.account });
      if (state === "released") await rewind.write.release([id, until, await authorize(id, 1, until)]);
      await networkHelpers.time.increaseTo(fulfilBy + 1n);
      const sig = await authorize(id, 2, until);
      if (state === "refunded") await rewind.write.refund([id, until, sig]);
      await viem.assertions.revertWithCustomError(rewind.write.refund([id, until, sig]), rewind, "InvalidState");
      if (state === "refunded") {
        await viem.assertions.revertWithCustomError(rewind.write.release([id, until, await authorize(id, 1, until)]), rewind, "InvalidState");
        await viem.assertions.revertWithCustomError(rewind.write.markFulfilled([id], { account: seller.account }), rewind, "InvalidState");
      }
    });
  }

  it("keeps agreements and their funding independent through release and refund", async () => {
    const { rewind, create, authorize } = await setup();
    const first = await create();
    const second = await create({ amount: AMOUNT * 2n, to: stranger.account.address });
    assert.equal(second.id, first.id + 1n);
    assert.equal(await client.getBalance({ address: rewind.address }), AMOUNT * 3n);
    await rewind.write.markFulfilled([first.id], { account: seller.account });
    const until = second.fulfilBy + 600n;
    await rewind.write.release([first.id, until, await authorize(first.id, 1, until)]);
    assert.equal(await client.getBalance({ address: rewind.address }), AMOUNT * 2n);
    assert.equal((await rewind.read.getAgreement([second.id])).state, State.Funded);
    await networkHelpers.time.increaseTo(second.fulfilBy + 1n);
    await rewind.write.refund([second.id, until, await authorize(second.id, 2, until)]);
    assert.equal(await client.getBalance({ address: rewind.address }), 0n);
    assert.equal((await rewind.read.getAgreement([first.id])).state, State.Released);
  });

  it("blocks a malicious seller's recursive release and sets terminal state before payment", async () => {
    const { rewind, create, authorize } = await setup();
    const attacker = await viem.deployContract("EscrowReceiver", [rewind.address]);
    const { id, fulfilBy } = await create({ to: attacker.address });
    const until = fulfilBy + 600n;
    const sig = await authorize(id, 1, until);
    await attacker.write.fulfill([id]);
    await attacker.write.configure([false, true, id, until, sig]);
    await rewind.write.release([id, until, sig]);
    assert.equal(await attacker.read.reentryBlocked(), true);
    assert.equal(await attacker.read.stateDuringPayment(), State.Released);
    assert.equal(await attacker.read.payments(), 1n);
    assert.equal(await client.getBalance({ address: attacker.address }), AMOUNT);
    assert.equal(await client.getBalance({ address: rewind.address }), 0n);
  });

  it("rolls back a failed seller payment and allows a later release retry", async () => {
    const { rewind, create, authorize } = await setup();
    const receiver = await viem.deployContract("EscrowReceiver", [rewind.address]);
    const { id, fulfilBy } = await create({ to: receiver.address });
    const until = fulfilBy + 600n;
    const sig = await authorize(id, 1, until);
    await receiver.write.fulfill([id]);
    await receiver.write.configure([true, false, id, until, sig]);
    await viem.assertions.revertWithCustomError(rewind.write.release([id, until, sig]), rewind, "PaymentFailed");
    assert.equal((await rewind.read.getAgreement([id])).state, State.Fulfilled);
    assert.equal(await client.getBalance({ address: rewind.address }), AMOUNT);
    assert.equal(await client.getBalance({ address: receiver.address }), 0n);
    await receiver.write.configure([false, false, id, until, sig]);
    await rewind.write.release([id, until, sig]);
    assert.equal(await client.getBalance({ address: receiver.address }), AMOUNT);
  });

  it("rolls back a failed buyer refund and permits retry with state set before payment", async () => {
    const { rewind, now, authorize } = await setup();
    const receiver = await viem.deployContract("EscrowReceiver", [rewind.address]);
    const fulfilBy = (await now()) + 3600n;
    const until = fulfilBy + 600n;
    const args = [seller.account.address, TERMS, fulfilBy] as const;
    const { result: id } = await receiver.simulate.create(args, { value: AMOUNT });
    await receiver.write.create(args, { value: AMOUNT });
    const sig = await authorize(id, 2, until, receiver.address);
    await receiver.write.configure([true, false, id, until, sig]);
    await networkHelpers.time.increaseTo(fulfilBy + 1n);
    await viem.assertions.revertWithCustomError(receiver.write.refund([id, until, sig]), rewind, "PaymentFailed");
    assert.equal((await rewind.read.getAgreement([id])).state, State.Funded);
    assert.equal(await client.getBalance({ address: rewind.address }), AMOUNT);
    await receiver.write.configure([false, false, id, until, sig]);
    await receiver.write.refund([id, until, sig]);
    assert.equal(await receiver.read.stateDuringPayment(), State.Refunded);
    assert.equal(await receiver.read.payments(), 1n);
    assert.equal(await client.getBalance({ address: receiver.address }), AMOUNT);
    assert.equal(await client.getBalance({ address: rewind.address }), 0n);
  });

  it("supports a contract buyer's authorized release only to the stored seller", async () => {
    const { rewind, now, authorize } = await setup();
    const receiver = await viem.deployContract("EscrowReceiver", [rewind.address]);
    const fulfilBy = (await now()) + 3600n;
    const args = [seller.account.address, TERMS, fulfilBy] as const;
    const { result: id } = await receiver.simulate.create(args, { value: AMOUNT });
    await receiver.write.create(args, { value: AMOUNT });
    await rewind.write.markFulfilled([id], { account: seller.account });
    const sig = await authorize(id, 1, fulfilBy, receiver.address);
    const before = await client.getBalance({ address: seller.account.address });
    await receiver.write.release([id, fulfilBy, sig]);
    assert.equal(await client.getBalance({ address: seller.account.address }), before + AMOUNT);
    assert.equal(await client.getBalance({ address: receiver.address }), 0n);
  });

  it("rejects direct native transfers outside createAgreement", async () => {
    const { rewind } = await setup();
    await assert.rejects(buyer.sendTransaction({ to: rewind.address, value: 1n }));
    assert.equal(await client.getBalance({ address: rewind.address }), 0n);
  });

  it("checks deterministic mock key metadata and the fake signature rule", async () => {
    const { status, verifier } = await setup();
    const pubkey = mockPublicKey(buyer.account.address);
    assert.deepEqual(await status.read.pqcKeyStatus([buyer.account.address]), [true, 1, pubkey, true]);
    assert.deepEqual(await status.read.pqcKeyStatus([NO_KEY]), [false, 0, "0x", false]);
    const message = keccak256(toHex("32-byte message"));
    const signature = mockSignature(buyer.account.address, message);
    assert.equal(await verifier.read.pqcVerify([pubkey, signature, message]), true);
    assert.equal(await verifier.read.pqcVerify([pubkey, "0x1234", message]), false);
    assert.equal(await verifier.read.pqcVerify([pubkey, signature, TERMS]), false);
  });
});
