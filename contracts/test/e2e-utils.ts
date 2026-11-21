import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evmToQor, qoreAddresses } from "@qorechain/sdk";
import {
  decodeFunctionResult, encodeAbiParameters, encodeFunctionData, hexToBytes,
  keccak256, parseAbiParameters, size, toHex, type Hex,
} from "viem";
import { ABI, publicAddressLines } from "../scripts/e2e.js";
import { loadRewindAddress } from "../scripts/rewind-address.js";
import {
  actionCode, computeDigest, DEMO_AMOUNT, DEMO_TERMS_HASH, MAX_UINT256,
  fulfilByFrom, oneHourFrom, parseArgs, parseFulfilMinutes, REWIND_ADDRESS,
  SELLER_SETUP, sellerReadyForSend, signatureSummary, utcTime, type DigestInput,
} from "../scripts/e2e-utils.js";

describe("E2E pure helpers (no RPC or environment loading)", () => {
  it("reports buyer, seller and deployed contract EVM/qor1 addresses without other account fields", async () => {
    const buyerEvm = "0x0000000000000000000000000000000000000011";
    const sellerEvm = "0x0000000000000000000000000000000000000022";
    const taint = "SENSITIVE_TEST_MARKER_DO_NOT_ECHO";
    const buyer = { ...qoreAddresses({ evm: buyerEvm }), mnemonic: taint, privateKey: taint };
    const seller = { ...qoreAddresses({ evm: sellerEvm }), mnemonic: taint, privateKey: taint };
    const contract = await loadRewindAddress(undefined);
    const lines = publicAddressLines(buyer, seller, contract);
    assert.deepEqual(lines, [
      `buyer 0x: ${buyerEvm}`,
      `buyer qor1: ${evmToQor(buyerEvm)}`,
      `seller index 1 0x: ${sellerEvm}`,
      `seller index 1 qor1: ${evmToQor(sellerEvm)}`,
      `Rewind 0x: ${contract}`,
      `Rewind qor1: ${evmToQor(contract)}`,
    ]);
    assert.equal(lines.join("\n").includes(taint), false);
  });

  it("parses create and fulfil as send steps by default", () => {
    assert.deepEqual(parseArgs(["create"]), { step: "create", send: true, fulfilInSeconds: 3600n });
    assert.deepEqual(parseArgs(["fulfil", "7"]), { step: "fulfil", id: 7n, send: true });
  });

  for (const step of ["create", "fulfil", "release", "refund"] as const) {
    it(`supports --dry before or after ${step}`, () => {
      const args = step === "create" ? [step] : [step, "7"];
      const expected = step === "create" ? { step, send: false, fulfilInSeconds: 3600n } : { step, id: 7n, send: false };
      assert.deepEqual(parseArgs(["--dry", ...args]), expected);
      assert.deepEqual(parseArgs([...args, "--dry"]), expected);
    });
  }

  for (const step of ["release", "refund"] as const) {
    it(`${step} sends only with explicit --send`, () => {
      assert.deepEqual(parseArgs([step, "9"]), { step, id: 9n, send: false });
      assert.deepEqual(parseArgs([step, "9", "--send"]), { step, id: 9n, send: true });
    });
  }

  it("parses the read-only state and digest commands", () => {
    assert.deepEqual(parseArgs(["state", "3"]), { step: "state", id: 3n });
    assert.deepEqual(parseArgs(["digest", "3", "release"]), { step: "digest", id: 3n, action: "release" });
    assert.deepEqual(parseArgs(["digest", "3", "refund"]), { step: "digest", id: 3n, action: "refund" });
  });

  it("parses create --fulfil-in before/after the step, including decimal minutes", () => {
    assert.deepEqual(parseArgs(["create", "--fulfil-in", "3", "--dry"]), {
      step: "create", send: false, fulfilInSeconds: 180n,
    });
    assert.deepEqual(parseArgs(["--fulfil-in", "3.5", "create", "--send"]), {
      step: "create", send: true, fulfilInSeconds: 210n,
    });
  });

  for (const value of ["0", "0.999", ".5", "-1", "NaN", "Infinity", "1e3", "abc", ""]) {
    it(`rejects invalid/sub-minute --fulfil-in: ${value || "(empty)"}`, () => {
      assert.throws(() => parseArgs(["create", "--fulfil-in", value]), /at least 1 minute/);
    });
  }

  for (const args of [
    ["create", "--fulfil-in"], ["create", "--fulfil-in", "--dry"],
    ["create", "--fulfil-in", "3", "--fulfil-in", "4"],
    ["fulfil", "1", "--fulfil-in", "3"], ["refund", "1", "--fulfil-in", "3"],
    ["state", "1", "--fulfil-in", "3"], ["addresses", "--fulfil-in", "3"],
  ]) {
    it(`rejects missing, repeated or misplaced deadline option: ${args.join(" ")}`, () => {
      assert.throws(() => parseArgs(args), /--fulfil-in/);
    });
  }

  it("calculates exact minute durations and rounds fractional seconds upward", () => {
    assert.equal(parseFulfilMinutes("1"), 60n);
    assert.equal(parseFulfilMinutes("3.5"), 210n);
    assert.equal(parseFulfilMinutes("1.1"), 66n);
    assert.equal(parseFulfilMinutes("1.01"), 61n);
    assert.equal(parseFulfilMinutes("1.0000000000000000001"), 61n);
    assert.equal(fulfilByFrom(1_700_000_000n), 1_700_003_600n);
    assert.equal(fulfilByFrom(1_700_000_000n, parseFulfilMinutes("3")), 1_700_000_180n);
    assert.equal(utcTime(1_700_000_180n), "2023-11-14T22:16:20.000Z");
  });

  it("rejects unsafe deadline ranges and invalid UTC dates", () => {
    const max = (1n << 64n) - 1n;
    assert.equal(fulfilByFrom(max - 60n, 60n), max);
    assert.throws(() => fulfilByFrom(max - 59n, 60n), /uint64/);
    assert.throws(() => fulfilByFrom(-1n, 60n), /uint64/);
    assert.throws(() => fulfilByFrom(1n, 59n), /at least 1 minute/);
    assert.throws(() => parseFulfilMinutes(max.toString()), /uint64/);
    assert.throws(() => utcTime(max), /UTC/);
  });

  it("never treats an unregistered seller as ready, even with a live window", () => {
    const status = { registered: true, algorithmId: 1, publicKeyLength: 2592 };
    const window = { live: true, remainingTxs: 1n, remainingBlocks: 1n };
    assert.equal(sellerReadyForSend(status, window), true);
    assert.equal(sellerReadyForSend({ ...status, registered: false }, window), false);
    assert.equal(sellerReadyForSend({ ...status, algorithmId: 2 }, window), false);
    assert.equal(sellerReadyForSend({ ...status, publicKeyLength: 0 }, window), false);
    assert.equal(sellerReadyForSend(status, { ...window, live: false }), false);
    assert.equal(sellerReadyForSend(status, { ...window, remainingTxs: 0n }), false);
    assert.equal(sellerReadyForSend(status, { ...window, remainingBlocks: 0n }), false);
    assert.equal(SELLER_SETUP, "seller needs: register (npm run window -- register --index 1) and a window (npm run window -- open --index 1)");
  });

  for (const args of [
    [], ["unknown"], ["create", "1"], ["fulfil"], ["release"], ["state"],
    ["digest", "1"], ["digest", "1", "unknown"], ["refund", "1", "extra"],
    ["create", "--send", "--dry"], ["create", "--dry", "--dry"],
    ["create", "--send=false"], ["create", "--force"],
    ["state", "1", "--send"], ["state", "1", "--dry"], ["digest", "1", "release", "--send"],
  ]) {
    it(`rejects invalid command arguments: ${args.join(" ") || "(empty)"}`, () => {
      assert.throws(() => parseArgs(args));
    });
  }

  for (const id of ["0", "-1", "1.5", "0x1", "1e3", "+1", (MAX_UINT256 + 1n).toString()]) {
    it(`rejects an invalid agreement ID: ${id}`, () => {
      assert.throws(() => parseArgs(["state", id]), /positive uint256/);
    });
  }

  it("preserves IDs beyond JavaScript's safe-integer range", () => {
    const id = 9_007_199_254_740_993n;
    assert.deepEqual(parseArgs(["state", id.toString()]), { step: "state", id });
    assert.deepEqual(parseArgs(["state", MAX_UINT256.toString()]), { step: "state", id: MAX_UINT256 });
  });

  it("adds exactly one hour in seconds to the supplied chain timestamp", () => {
    assert.equal(oneHourFrom(1_700_000_000n), 1_700_003_600n);
    assert.equal(oneHourFrom(0n), 3600n);
  });

  it("rejects negative/overflowing deadlines at uint64 boundaries", () => {
    const max = (1n << 64n) - 1n;
    assert.equal(oneHourFrom(max - 3600n), max);
    assert.throws(() => oneHourFrom(max - 3599n));
    assert.throws(() => oneHourFrom(-1n));
  });

  const input: DigestInput = {
    chainId: 9800n, contract: REWIND_ADDRESS, id: 7n, action: "release",
    buyer: "0x0000000000000000000000000000000000000011",
    seller: "0x0000000000000000000000000000000000000022",
    amount: DEMO_AMOUNT, termsHash: DEMO_TERMS_HASH, validUntil: 1_700_003_600n,
  };

  it("matches an independently assembled ABI payload including the dynamic domain string", () => {
    const word = (value: bigint) => value.toString(16).padStart(64, "0");
    const addressWord = (value: string) => value.slice(2).toLowerCase().padStart(64, "0");
    // Ten head words, then the dynamic string length and padded UTF-8 domain.
    const encoded: Hex = `0x${[
      word(320n), word(9800n), addressWord(REWIND_ADDRESS), word(7n), word(1n),
      addressWord(input.buyer), addressWord(input.seller), word(DEMO_AMOUNT),
      DEMO_TERMS_HASH.slice(2), word(input.validUntil), word(9n),
      Buffer.from("REWIND_V1", "utf8").toString("hex").padEnd(64, "0"),
    ].join("")}`;
    assert.equal(computeDigest(input), keccak256(encoded));
    assert.equal(hexToBytes(computeDigest(input)).length, 32);
  });

  const mutations: Partial<DigestInput>[] = [
    { chainId: 9801n }, { contract: "0x0000000000000000000000000000000000000033" },
    { id: 8n }, { action: "refund" }, { buyer: input.seller }, { seller: input.buyer },
    { amount: DEMO_AMOUNT + 1n }, { termsHash: keccak256(toHex("other terms")) },
    { validUntil: input.validUntil + 1n },
  ];
  for (const mutation of mutations) {
    it(`binds the digest to ${Object.keys(mutation)[0]}`, () => {
      assert.notEqual(computeDigest({ ...input, ...mutation }), computeDigest(input));
    });
  }

  it("maps the action codes and fixes the requested demo amount and terms", () => {
    assert.equal(actionCode("release"), 1);
    assert.equal(actionCode("refund"), 2);
    assert.equal(DEMO_AMOUNT, 1_000_000_000_000_000n);
    assert.equal(DEMO_TERMS_HASH, keccak256(toHex("rewind-demo-order-1")));
  });

  it("encodes the release digest bytes and decodes all getAgreement fields with the runner ABI", () => {
    const encoded = encodeAbiParameters(
      parseAbiParameters("(address buyer,address seller,uint256 amount,bytes32 termsHash,uint64 fulfilBy,uint8 state)"),
      [{ buyer: input.buyer, seller: input.seller, amount: DEMO_AMOUNT, termsHash: DEMO_TERMS_HASH, fulfilBy: 1_700_003_600n, state: 1 }],
    );
    const decoded = decodeFunctionResult({ abi: ABI, functionName: "getAgreement", data: encoded });
    assert.equal(decoded.amount, DEMO_AMOUNT);
    assert.equal(decoded.fulfilBy, 1_700_003_600n);
    assert.equal(decoded.state, 1);
    assert.equal(size(encodeFunctionData({ abi: ABI, functionName: "digestFor", args: [7n, 1, input.validUntil] })), 4 + 3 * 32);
  });

  it("limits signature output to its byte length and first eight bytes", () => {
    const signature = new Uint8Array(4627).fill(0xaa);
    signature[8] = 0xbb;
    assert.deepEqual(signatureSummary(signature), { length: 4627, prefix: "0xaaaaaaaaaaaaaaaa" });
    assert.deepEqual(signatureSummary(new Uint8Array()), { length: 0, prefix: "0x" });
  });
});
