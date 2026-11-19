import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { encodeErrorResult, type Address } from "viem";
import { parseEvmWindow } from "@qorechain/evm";
import { ABI } from "../scripts/e2e.js";
import { rewindErrorName } from "../scripts/e2e-errors.js";
import {
  assessSignatureAttack, assessTransferRejection, assertScopedTransferReady,
  ATTACK_DESCRIPTION, parseAttackArgs, TRANSFER_TARGET,
} from "../scripts/attack-demo-utils.js";
import { parseWindowScope } from "../scripts/window-scope.js";
import { main } from "../scripts/attack-demo.js";

const REWIND: Address = "0x775BbF36986FaBC54b64955c1D9b8EdB388E7c20";
const TAINT = "SENSITIVE_TEST_MARKER_DO_NOT_ECHO";

describe("A classical-key attack demonstration (offline)", () => {
  for (const attack of ["release-forged", "release-no-sig", "refund-forged"] as const) {
    it(`parses ${attack} with a default or explicit agreement ID`, () => {
      assert.deepEqual(parseAttackArgs([attack]), { attack, id: 1n });
      assert.deepEqual(parseAttackArgs([attack, "2"]), { attack, id: 2n });
    });
  }
  it("requires --send only for the real transfer, with no default broadcast", () => {
    assert.deepEqual(parseAttackArgs(["transfer-out"]), { attack: "transfer-out", send: false });
    assert.deepEqual(parseAttackArgs(["transfer-out", "--send"]), { attack: "transfer-out", send: true });
    assert.deepEqual(parseAttackArgs(["--send", "transfer-out"]), { attack: "transfer-out", send: true });
  });
  for (const args of [[], ["unknown"], ["release-forged", "--send"], ["release-no-sig", "--dry"],
    ["refund-forged", "0"], ["refund-forged", "-1"], ["release-forged", "1.5"],
    ["release-forged", (1n << 256n).toString()], ["release-forged", "1", "2"],
    ["transfer-out", "1"], ["transfer-out", "--send", "--send"], ["transfer-out", "--unknown"],
  ]) {
    it(`refuses invalid arguments: ${args.join(" ") || "(empty)"}`, () => assert.throws(() => parseAttackArgs(args)));
  }
  it("passes signature rejection only when the expected path reaches InvalidPqcSignature", () => {
    for (const attack of ["release-forged", "release-no-sig"] as const) {
      assert.equal(assessSignatureAttack(attack, "InvalidPqcSignature", { state: 2, fulfilBy: 100n }, 101n).pass, true);
    }
    assert.equal(assessSignatureAttack("refund-forged", "InvalidPqcSignature", { state: 1, fulfilBy: 100n }, 101n).pass, true);
    assert.equal(assessSignatureAttack("refund-forged", "InvalidPqcSignature", { state: 1, fulfilBy: 100n }, 100n).pass, false);
    for (const name of [undefined, "OnlyBuyer", "PqcKeyNotRegistered", "PqcPossessionNotProven"]) {
      assert.equal(assessSignatureAttack("release-forged", name, { state: 2, fulfilBy: 100n }, 101n).pass, false);
    }
  });
  it("does not count earlier state/deadline reverts as a PQC signature result", () => {
    const state = assessSignatureAttack("release-forged", "InvalidState", { state: 4, fulfilBy: 100n }, 101n);
    assert.equal(state.pass, false);
    assert.match(state.message, /state check runs before the signature check/);
    const deadline = assessSignatureAttack("refund-forged", "RefundNotAvailable", { state: 1, fulfilBy: 100n }, 99n);
    assert.equal(deadline.pass, false);
    assert.match(deadline.message, /deadline check runs before the signature check/);
  });
  it("decodes ABI-whitelisted errors and never uses provider strings as error names", () => {
    for (const errorName of ["InvalidState", "InvalidPqcSignature", "RefundNotAvailable"] as const) {
      const error = { cause: { data: encodeErrorResult({ abi: ABI, errorName }) } };
      assert.equal(rewindErrorName(error, ABI), errorName);
    }
    assert.equal(rewindErrorName({ errorName: TAINT, message: "InvalidPqcSignature" }, ABI), undefined);
    assert.equal(rewindErrorName({ cause: { data: { errorName: "OnlyBuyer", args: [TAINT] } } }, ABI), "OnlyBuyer");
  });
  const rawWindow = { found: true, live: true, remaining_txs: "5", remaining_blocks: "600", remaining_value: "99999999", native_only: false, allowed_targets: [REWIND] };
  it("requires explicit Rewind-only scope and live allowances before transfer-out", () => {
    assert.doesNotThrow(() => assertScopedTransferReady(parseEvmWindow(rawWindow), parseWindowScope(rawWindow), REWIND));
    for (const change of [
      { live: false }, { remaining_txs: "0" }, { remaining_blocks: "0" }, { remaining_value: "0" },
      { allowed_targets: undefined }, { allowed_targets: [] }, { allowed_targets: [REWIND, TRANSFER_TARGET] },
      { allowed_targets: [TRANSFER_TARGET] }, { native_only: undefined }, { native_only: true },
    ]) {
      const raw = { ...rawWindow, ...change };
      assert.throws(() => assertScopedTransferReady(parseEvmWindow(raw), parseWindowScope(raw), REWIND));
    }
  });
  it("does not claim window enforcement from unrelated or ambiguous RPC failures", () => {
    for (const error of [{ message: TAINT }, { message: "no open EVM authorisation window" }, { message: "has no registered post-quantum key" }]) {
      const result = assessTransferRejection(error);
      assert.equal(result.pass, false);
      assert.equal(result.message.includes(TAINT), false);
    }
    const blocked = assessTransferRejection({ message: `does not admit this transaction ${TAINT}` });
    assert.equal(blocked.pass, true);
    assert.match(blocked.message, /does not distinguish target scoping from allowances changing/);
    assert.equal(blocked.message.includes(TAINT), false);
  });
  it("defaults transfer-out to an offline preview with no credential or network access", async () => {
    const originalLog = console.log;
    const originalFetch = globalThis.fetch;
    const oldNetwork = process.env.QORE_NETWORK;
    const lines: string[] = [];
    console.log = (...args: unknown[]) => { lines.push(args.join(" ")); };
    globalThis.fetch = async () => { throw new Error("Network access must not occur in preview"); };
    process.env.QORE_NETWORK = "testnet";
    try {
      const result = await main(["transfer-out"]);
      assert.equal(result.pass, true);
      assert.match(result.message, /chain rejection has not been tested/);
      assert.ok(lines.includes(ATTACK_DESCRIPTION));
      assert.ok(lines.some((line) => line.includes("not in a simulation")));
    } finally {
      console.log = originalLog;
      globalThis.fetch = originalFetch;
      if (oldNetwork === undefined) delete process.env.QORE_NETWORK;
      else process.env.QORE_NETWORK = oldNetwork;
    }
  });
});
