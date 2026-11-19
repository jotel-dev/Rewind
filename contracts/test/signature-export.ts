import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { size, type Hex } from "viem";
import { fulfilByFrom, parseArgs } from "../scripts/e2e-utils.js";
import { signatureExport, signatureFilename } from "../scripts/signature-export.js";

describe("Signature export (offline)", () => {
  it("parses both actions with a 30-minute default or explicit decimal override", () => {
    for (const action of ["release", "refund"] as const) {
      assert.deepEqual(parseArgs(["sign", "2", action]), { step: "sign", id: 2n, action, validSeconds: 1800n });
      assert.deepEqual(parseArgs(["sign", "2", action, "--valid-minutes", "10.5"]), { step: "sign", id: 2n, action, validSeconds: 630n });
    }
    assert.equal(fulfilByFrom(1000n, 1800n), 2800n);
  });
  it("rejects missing/repeated/invalid validity and all broadcasting flags", () => {
    for (const args of [["sign", "2", "release", "--send"], ["sign", "2", "release", "--dry"],
      ["sign", "2", "unknown"], ["sign", "2", "release", "--valid-minutes"],
      ["sign", "2", "release", "--valid-minutes", "0"], ["sign", "2", "release", "--valid-minutes", "NaN"],
      ["sign", "2", "release", "--valid-minutes", "1", "--valid-minutes", "2"], ["digest", "2", "release", "--valid-minutes", "30"]]) assert.throws(() => parseArgs(args));
  });
  it("serializes only the five public fields with decimal strings for large integers", () => {
    const digest = `0x${"ab".repeat(32)}` as Hex;
    const payload = signatureExport(2n, "refund", 2800n, digest, new Uint8Array(4627));
    assert.deepEqual(Object.keys(payload), ["id", "action", "validUntil", "digest", "signature"]);
    assert.equal(payload.id, "2");
    assert.equal(payload.validUntil, "2800");
    assert.equal(payload.digest, digest);
    assert.equal(size(payload.signature), 4627);
    assert.deepEqual(JSON.parse(JSON.stringify(payload)), payload);
    assert.equal(signatureFilename(2n, "refund"), "signature-2-refund.json");
    assert.throws(() => signatureFilename(0n, "refund"));
    assert.throws(() => signatureExport(2n, "refund", 2800n, "0x", new Uint8Array(4627)));
    assert.throws(() => signatureExport(2n, "refund", 2800n, digest, new Uint8Array(4626)));
  });
});
