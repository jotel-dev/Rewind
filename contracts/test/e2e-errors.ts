import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ContractFunctionRevertedError, encodeErrorResult, HttpRequestError, parseAbi, type Address } from "viem";
import { ABI } from "../scripts/e2e.js";
import { parseArgs } from "../scripts/e2e-utils.js";
import {
  categorizeFailure, diagnose, endpointHost, formatFailure, insufficientFunds,
  invalidVariable, requiredVariable, sellerAddressStatus, sellerMismatch,
} from "../scripts/e2e-errors.js";

const BUYER: Address = "0x0000000000000000000000000000000000000011";
const SELLER: Address = "0x0000000000000000000000000000000000000022";
// Synthetic tainted text, not any real credential. It must never enter diagnostics.
const TAINT = "SENSITIVE_TEST_MARKER_DO_NOT_ECHO";
const ENDPOINT = `https://username:${TAINT}@evm-testnet.qore.host/private-path?token=${TAINT}`;

describe("E2E diagnostics (offline)", () => {
  for (const name of ["QORE_MNEMONIC", "SELLER_ADDRESS"] as const) {
    for (const value of [undefined, "", "  "]) {
      it(`reports missing ${name} by name only (${value === undefined ? "unset" : value.length === 0 ? "empty" : "whitespace"})`, () => {
        assert.throws(() => requiredVariable(name, value), (error: unknown) => {
          assert.equal(formatFailure(error), `[ENV_MISSING] Required environment variable: ${name}.`);
          return true;
        });
      });
    }
    it(`reports invalid ${name} without its value`, () => {
      assert.equal(formatFailure(invalidVariable(name)), `[ENV_INVALID] Invalid environment variable: ${name}.`);
    });
  }

  it("accepts a required value without attaching it to an error", () => {
    assert.equal(requiredVariable("SELLER_ADDRESS", ` ${SELLER} `), SELLER);
  });

  it("prints both public addresses for a seller mismatch", () => {
    const text = formatFailure(sellerMismatch(SELLER, BUYER));
    assert.match(text, /^\[ADDRESS_MISMATCH\]/);
    assert.ok(text.includes(SELLER));
    assert.ok(text.includes(BUYER));
  });

  it("reports configured seller presence, validity and matching without exposing malformed values", () => {
    assert.deepEqual(sellerAddressStatus(SELLER, undefined), { set: false, valid: false, address: undefined, matches: false });
    assert.deepEqual(sellerAddressStatus(SELLER, TAINT), { set: true, valid: false, address: undefined, matches: false });
    assert.equal(sellerAddressStatus(SELLER, SELLER).matches, true);
    assert.equal(sellerAddressStatus(SELLER, BUYER).matches, false);
    assert.equal(sellerAddressStatus(SELLER, "0x0000000000000000000000000000000000000000").valid, false);
    assert.equal(JSON.stringify(sellerAddressStatus(SELLER, TAINT)).includes(TAINT), false);
  });

  it("strips credentials, paths and query strings from endpoint diagnostics", () => {
    assert.equal(endpointHost(ENDPOINT), "evm-testnet.qore.host");
    assert.equal(endpointHost(TAINT), "configured RPC host");
    assert.equal(endpointHost(undefined), "configured RPC host");
  });

  it("recognizes viem HTTP failures without printing their request bodies or details", () => {
    const error = new HttpRequestError({
      url: ENDPOINT, body: { params: [TAINT] }, details: TAINT,
      cause: Object.assign(new Error(TAINT), { code: "ECONNREFUSED" }),
    });
    assert.equal(formatFailure(error, { endpoint: ENDPOINT, operation: "connection" }),
      "[RPC_UNREACHABLE] Could not reach RPC host evm-testnet.qore.host.");
  });

  for (const status of [401, 503]) {
    it(`distinguishes an HTTP ${status} response from an unreachable host`, () => {
      const error = new HttpRequestError({ url: ENDPOINT, status, body: { params: [TAINT] }, details: TAINT });
      const text = formatFailure(error, { endpoint: ENDPOINT, operation: "read" });
      assert.match(text, /^\[RPC_REJECTED\]/);
      assert.ok(text.includes(`HTTP ${status}`));
      assert.equal(text.includes(TAINT), false);
    });
  }

  for (const code of ["ENOTFOUND", "ETIMEDOUT", "ECONNRESET", "UND_ERR_CONNECT_TIMEOUT"]) {
    it(`recognizes a nested transport failure (${code})`, () => {
      const error = { message: TAINT, cause: { code, message: TAINT } };
      assert.equal(categorizeFailure(error, { endpoint: ENDPOINT }).category, "RPC_UNREACHABLE");
      assert.equal(formatFailure(error, { endpoint: ENDPOINT }).includes(TAINT), false);
    });
  }

  for (const errorName of ["AgreementNotFound", "OnlySeller"] as const) {
    it(`decodes nested raw RPC revert data (${errorName})`, () => {
      const data = encodeErrorResult({ abi: ABI, errorName });
      const error = { name: "CallExecutionError", body: TAINT, cause: {
        name: "RpcRequestError", code: -32000, data: { originalError: { data } }, message: TAINT,
      } };
      assert.equal(formatFailure(error, { abi: ABI, endpoint: ENDPOINT, operation: "simulation" }),
        `[SIMULATION_REVERTED] Rewind custom error: ${errorName}.`);
    });
  }

  it("recognizes a decoded viem custom error before simulation, during an agreement read", () => {
    const error = new ContractFunctionRevertedError({
      abi: ABI, data: encodeErrorResult({ abi: ABI, errorName: "AgreementNotFound" }), functionName: "getAgreement",
    });
    assert.equal(formatFailure(new Error(TAINT, { cause: error }), { abi: ABI, operation: "read" }),
      "[CONTRACT_REVERTED] Rewind custom error: AgreementNotFound.");
  });

  it("suppresses arbitrary contract revert strings and unrecognized error names", () => {
    const data = encodeErrorResult({ abi: parseAbi(["error Error(string)"]), errorName: "Error", args: [TAINT] });
    const error = { code: 3, data, reason: TAINT, request: { signature: TAINT } };
    const text = formatFailure(error, { abi: ABI, operation: "simulation" });
    assert.match(text, /^\[SIMULATION_REVERTED\]/);
    assert.equal(text.includes(TAINT), false);
    assert.equal(text.includes(data), false);
    assert.equal(formatFailure({ data: { errorName: TAINT } }, { abi: ABI }).includes(TAINT), false);
  });

  it("prints public address and exact native balance for insufficient funds", () => {
    assert.equal(formatFailure(insufficientFunds(SELLER, 0n)),
      `[INSUFFICIENT_FUNDS] Account ${SELLER} balance: 0 QOR (0 wei). Insufficient funds for value plus gas.`);
    const error = { name: "CallExecutionError", cause: { name: "InsufficientFundsError", message: TAINT } };
    const text = formatFailure(error, { address: SELLER, balance: 1_250_000_000_000_000_000n });
    assert.match(text, /1\.25 QOR \(1250000000000000000 wei\)/);
    assert.equal(text.includes(TAINT), false);
  });

  it("does not invent a balance if one is unavailable", () => {
    assert.equal(formatFailure({ name: "InsufficientFundsError" }),
      "[INSUFFICIENT_FUNDS] Insufficient gas funds; current balance is unavailable.");
  });

  it("distinguishes RPC rejection from unreachable transport without echoing provider text", () => {
    const error = { name: "RpcRequestError", code: -32601, message: TAINT, body: TAINT };
    const text = formatFailure(error, { endpoint: ENDPOINT });
    assert.match(text, /^\[RPC_REJECTED\]/);
    assert.ok(text.includes("evm-testnet.qore.host"));
    assert.equal(text.includes(TAINT), false);
  });

  it("never infers a contract error name from arbitrary message text", () => {
    const error = new Error(`OnlySeller ${TAINT}`);
    assert.equal(categorizeFailure(error, { abi: ABI, endpoint: ENDPOINT }).category, "RPC_REQUEST_FAILED");
    assert.equal(formatFailure(error, { abi: ABI }).includes(TAINT), false);
  });

  it("handles cyclic causes and unknown errors without serializing them", () => {
    const error: { message: string; cause?: unknown } = { message: TAINT };
    error.cause = error;
    assert.match(formatFailure(error), /^\[UNEXPECTED\]/);
    assert.equal(formatFailure(error).includes(TAINT), false);
  });

  it("preserves the category when marking a broadcast outcome uncertain", async () => {
    await assert.rejects(diagnose(async () => { throw { name: "TimeoutError", body: TAINT }; }, {
      operation: "broadcast", endpoint: ENDPOINT,
    }), (error: unknown) => {
      const text = formatFailure(error);
      assert.match(text, /^\[RPC_UNREACHABLE\]/);
      assert.match(text, /outcome may be unknown/);
      assert.equal(text.includes(TAINT), false);
      return true;
    });
  });

  it("preserves successful read results", async () => {
    assert.equal(await diagnose(async () => 123n, { operation: "read" }), 123n);
  });

  it("parses addresses and balances as read-only steps without IDs", () => {
    assert.deepEqual(parseArgs(["addresses"]), { step: "addresses" });
    assert.deepEqual(parseArgs(["balances"]), { step: "balances" });
    for (const step of ["addresses", "balances"]) {
      assert.throws(() => parseArgs([step, "1"]));
      assert.throws(() => parseArgs([step, "--send"]), /Read-only/);
      assert.throws(() => parseArgs([step, "--dry"]), /Read-only/);
    }
  });
});
