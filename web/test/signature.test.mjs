import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import ts from "typescript";
// Compile the pure browser helpers with the existing compiler; no network or env files.
await mkdir(new URL("../.review/tests/abi/", import.meta.url), { recursive: true });
for (const file of ["lib", "abi/rewind"]) {
  const source = await readFile(new URL(`../src/${file}.ts`, import.meta.url), "utf8");
  const result = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } });
  await writeFile(new URL(`../.review/tests/${file}.js`, import.meta.url), result.outputText);
}
const { parseSignature, paymentId, safeError } = await import("../.review/tests/lib.js");
const signature = `0x${"ab".repeat(4627)}`;
const digest = `0x${"cd".repeat(32)}`;
const exported = { id: "2", action: "refund", validUntil: "1800000000", digest, signature };
describe("Public signature import", () => {
  it("imports exactly the CLI format and its own expiry", () => {
    const result = parseSignature(JSON.stringify(exported), 2n, "refund");
    assert.deepEqual(result, { id: 2n, action: "refund", validUntil: 1800000000n, digest, signature });
  });
  it("rejects mismatched agreement or action before accepting any signature", () => {
    assert.throws(() => parseSignature(JSON.stringify(exported), 1n, "refund"), /does not match/);
    assert.throws(() => parseSignature(JSON.stringify(exported), 2n, "release"), /does not match/);
  });
  it("checks length and format for raw signatures without inventing metadata", () => {
    assert.deepEqual(parseSignature(signature, 2n, "refund"), { signature });
    for (const value of ["0x", signature.slice(0, -2), signature + "ab", "0x" + "zz".repeat(4627)]) assert.throws(() => parseSignature(value, 2n, "refund"));
  });
  it("refuses extra fields, missing metadata, malformed expiries and oversized input", () => {
    for (const payload of [{ ...exported, extra: "unexpected" }, { ...exported, digest: "0x01" },
      { ...exported, validUntil: "-1" }, { ...exported, validUntil: (1n << 256n).toString() },
      { signature }, { ...exported, signature: "0x01" }]) assert.throws(() => parseSignature(JSON.stringify(payload), 2n, "refund"));
    assert.throws(() => parseSignature("x".repeat(14001), 2n, "refund"));
  });
  it("never echoes arbitrary pasted or provider text in errors", () => {
    const taint = "PRIVATE_TEST_MARKER_NOT_A_REAL_CREDENTIAL";
    assert.throws(() => parseSignature(taint, 2n, "refund"), (error) => !error.message.includes(taint));
    assert.equal(safeError({ message: taint }).includes(taint), false);
    assert.match(safeError({ code: 4001 }), /cancelled/);
    assert.match(safeError({ cause: { data: { errorName: "AgreementNotFound", args: [taint] } } }), /AgreementNotFound/);
    assert.equal(safeError({ data: { errorName: taint } }).includes(taint), false);
  });
  it("bounds payment IDs to positive uint256 values", () => {
    assert.equal(paymentId("2"), 2n);
    for (const value of ["0", "-1", "1.5", "bad", (1n << 256n).toString()]) assert.equal(paymentId(value), undefined);
  });
});
