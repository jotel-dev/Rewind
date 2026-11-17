import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evmToQor } from "@qorechain/sdk";
import { encodeAbiParameters, getAddress, parseAbiParameters, type Hex } from "viem";
import { decodeKeyStatus, normalizeAddress } from "../scripts/probe-pqc.js";

const ACCOUNT = "0x0000000000000000000000000000000000001234";
const KEY: Hex = `0x${"ab".repeat(2592)}`;

describe("PQC probe (offline decoding only)", () => {
  it("decodes four outputs and exposes key length without key bytes", () => {
    const data = encodeAbiParameters(parseAbiParameters("bool,uint8,bytes,bool"), [true, 1, KEY, true]);
    assert.deepEqual(decodeKeyStatus(data), {
      shape: "4-output", registered: true, algorithmId: 1, publicKeyLength: 2592, possessionProven: true,
    });
    assert.equal(JSON.stringify(decodeKeyStatus(data)).includes(KEY), false);
  });

  it("retains false possession proof on a four-output response", () => {
    const data = encodeAbiParameters(parseAbiParameters("bool,uint8,bytes,bool"), [true, 1, KEY, false]);
    assert.equal(decodeKeyStatus(data).possessionProven, false);
  });

  it("falls back to the installed three-output shape", () => {
    const data = encodeAbiParameters(parseAbiParameters("bool,uint8,bytes"), [true, 1, KEY]);
    assert.deepEqual(decodeKeyStatus(data), {
      shape: "3-output", registered: true, algorithmId: 1, publicKeyLength: 2592,
    });
  });

  it("distinguishes a legacy empty key from a fourth false output", () => {
    const legacy = encodeAbiParameters(parseAbiParameters("bool,uint8,bytes"), [false, 0, "0x"]);
    const current = encodeAbiParameters(parseAbiParameters("bool,uint8,bytes,bool"), [false, 0, "0x", false]);
    assert.equal(decodeKeyStatus(legacy).shape, "3-output");
    assert.equal(decodeKeyStatus(legacy).possessionProven, undefined);
    assert.equal(decodeKeyStatus(current).shape, "4-output");
    assert.equal(decodeKeyStatus(current).possessionProven, false);
  });

  for (const data of [undefined, "0x", "0x12"] as const) {
    it(`rejects ${data === undefined ? "missing" : data === "0x" ? "empty" : "malformed"} return data`, () => {
      assert.throws(() => decodeKeyStatus(data), /Empty response|could not be decoded/);
    });
  }

  it("sanitizes decoding errors instead of including raw response bytes", () => {
    const invalid: Hex = `0x${"aa".repeat(200)}`;
    assert.throws(() => decodeKeyStatus(invalid), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message.includes(invalid), false);
      return true;
    });
  });

  it("normalizes an EVM address", () => {
    assert.equal(normalizeAddress(ACCOUNT), getAddress(ACCOUNT));
  });

  it("converts a qor1 account using the installed SDK helper", () => {
    assert.equal(normalizeAddress(evmToQor(ACCOUNT)), getAddress(ACCOUNT));
  });

  for (const input of ["not-an-address", "qor1invalid", evmToQor("0x1234"), evmToQor(ACCOUNT, "cosmos")]) {
    it(`rejects an invalid or unsupported address: ${input}`, () => {
      assert.throws(() => normalizeAddress(input), /valid 20-byte/);
    });
  }
});
