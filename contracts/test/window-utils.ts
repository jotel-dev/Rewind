import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertIndexSource, assertSelectedSeller, parseWindowArgs } from "../scripts/window-utils.js";

describe("Window arguments and seller selection (offline)", () => {
  it("defaults to status and index zero", () => {
    assert.deepEqual(parseWindowArgs([]), { command: "status", index: 0 });
    for (const command of ["status", "register", "open", "recovery-code"]) {
      assert.deepEqual(parseWindowArgs([command]), { command, index: 0 });
    }
  });

  for (const command of ["status", "register", "open"]) {
    it(`selects index 1 for ${command}`, () => {
      assert.deepEqual(parseWindowArgs([command, "--index", "1"]), { command, index: 1 });
      assert.deepEqual(parseWindowArgs(["--index", "1", command]), { command, index: 1 });
    });
  }

  it("supports an indexed default status and the largest unhardened index", () => {
    assert.deepEqual(parseWindowArgs(["--index", "1"]), { command: "status", index: 1 });
    assert.deepEqual(parseWindowArgs(["status", "--index", "2147483647"]), { command: "status", index: 2147483647 });
  });

  for (const args of [
    ["open", "--index"], ["open", "--index", "-1"], ["open", "--index", "1.5"],
    ["open", "--index", "NaN"], ["open", "--index", "2147483648"],
    ["open", "--index", "9007199254740993"], ["open", "--index", "1", "--index", "2"],
    ["recovery-code", "--index", "1"], ["open", "--unknown"], ["open", "register"],
  ]) {
    it(`rejects invalid window arguments: ${args.join(" ")}`, () => {
      assert.throws(() => parseWindowArgs(args));
    });
  }

  it("keeps raw-key selection at index zero and requires a mnemonic for other indices", () => {
    assert.doesNotThrow(() => assertIndexSource(0, false));
    assert.doesNotThrow(() => assertIndexSource(1, true));
    assert.throws(() => assertIndexSource(1, false), /requires QORE_MNEMONIC/);
  });

  const seller = "0x0000000000000000000000000000000000000022";
  const other = "0x0000000000000000000000000000000000000011";
  it("checks SELLER_ADDRESS only for index one when configured", () => {
    assert.doesNotThrow(() => assertSelectedSeller(0, seller, other));
    assert.doesNotThrow(() => assertSelectedSeller(1, seller, undefined));
    assert.doesNotThrow(() => assertSelectedSeller(1, seller, seller));
    assert.throws(() => assertSelectedSeller(1, seller, other), /does not match SELLER_ADDRESS/);
  });

  it("does not echo a malformed configured value", () => {
    const taint = "SENSITIVE_TEST_MARKER_DO_NOT_ECHO";
    assert.throws(() => assertSelectedSeller(1, seller, taint), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message.includes(taint), false);
      return true;
    });
  });
});
