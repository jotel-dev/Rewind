import {
  encodeAbiParameters, keccak256, parseAbiParameters, toHex, type Address, type Hex,
} from "viem";

export const REWIND_ADDRESS: Address = "0x775BbF36986FaBC54b64955c1D9b8EdB388E7c20";
export const DEMO_AMOUNT = 1_000_000_000_000_000n;
export const DEMO_TERMS_HASH = keccak256(toHex("rewind-demo-order-1"));
export const STATE_NAMES = ["None", "Funded", "Fulfilled", "Released", "Refunded"] as const;
export const MAX_UINT256 = (1n << 256n) - 1n;
const MAX_UINT64 = (1n << 64n) - 1n;

export class E2eError extends Error {}
export type Action = "release" | "refund";
export type E2eCommand =
  | { step: "addresses" }
  | { step: "balances" }
  | { step: "create"; send: boolean; fulfilInSeconds: bigint }
  | { step: "fulfil" | Action; id: bigint; send: boolean }
  | { step: "digest"; id: bigint; action: Action }
  | { step: "sign"; id: bigint; action: Action; validSeconds: bigint }
  | { step: "state"; id: bigint };

/** Strict parsing avoids accidental sending from misspelled/contradictory flags. */
export function parseArgs(argv: readonly string[]): E2eCommand {
  const flags: string[] = [];
  const args: string[] = [];
  let fulfilInSeconds: bigint | undefined;
  let validSeconds: bigint | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--valid-minutes") {
      if (validSeconds !== undefined) throw new E2eError("--valid-minutes cannot be repeated.");
      const minutes = argv[++i];
      if (minutes === undefined || minutes.startsWith("--")) throw new E2eError("--valid-minutes requires a value in minutes.");
      try { validSeconds = parseFulfilMinutes(minutes); }
      catch { throw new E2eError("--valid-minutes must be a decimal number of minutes, at least 1 minute, within the uint64 range."); }
    } else if (arg === "--fulfil-in") {
      if (fulfilInSeconds !== undefined) throw new E2eError("--fulfil-in cannot be repeated.");
      const minutes = argv[++i];
      if (minutes === undefined || minutes.startsWith("--")) throw new E2eError("--fulfil-in requires a value in minutes.");
      fulfilInSeconds = parseFulfilMinutes(minutes);
    } else if (arg.startsWith("--")) flags.push(arg);
    else args.push(arg);
  }
  if (flags.some((flag) => flag !== "--dry" && flag !== "--send") || new Set(flags).size !== flags.length) {
    throw new E2eError("Unknown or repeated flag. Use --dry or --send.");
  }
  if (flags.includes("--dry") && flags.includes("--send")) {
    throw new E2eError("--dry and --send cannot be combined.");
  }
  const step = args[0];
  if (!["addresses", "balances", "create", "fulfil", "digest", "sign", "release", "refund", "state"].includes(step)) {
    throw new E2eError("Usage: e2e.ts addresses | balances | create | fulfil <id> | digest <id> <release|refund> | sign <id> <release|refund> [--valid-minutes n] | release <id> | refund <id> | state <id>");
  }
  if (fulfilInSeconds !== undefined && step !== "create") throw new E2eError("--fulfil-in is supported only for create.");
  if (validSeconds !== undefined && step !== "sign") throw new E2eError("--valid-minutes is supported only for sign.");
  const expected = step === "create" || step === "addresses" || step === "balances" ? 1 : step === "digest" || step === "sign" ? 3 : 2;
  if (args.length !== expected) throw new E2eError("Wrong argument count for this step.");
  if ((step === "digest" || step === "sign" || step === "state" || step === "addresses" || step === "balances") && flags.length !== 0) {
    throw new E2eError("Read-only steps do not accept --send or --dry.");
  }
  if (step === "addresses" || step === "balances") return { step };
  const send = flags.includes("--send") || (!flags.includes("--dry") && (step === "create" || step === "fulfil"));
  if (step === "create") return { step, send, fulfilInSeconds: fulfilInSeconds ?? 3600n };
  if (!/^[0-9]+$/.test(args[1])) throw new E2eError("Agreement ID must be a positive uint256 integer.");
  const id = BigInt(args[1]);
  if (id === 0n || id > MAX_UINT256) throw new E2eError("Agreement ID must be a positive uint256 integer.");
  if (step === "digest" || step === "sign") {
    const action = args[2];
    if (action !== "release" && action !== "refund") throw new E2eError("Digest action must be release or refund.");
    return step === "sign" ? { step, id, action, validSeconds: validSeconds ?? 1800n } : { step, id, action };
  }
  if (step === "state") return { step, id };
  return { step: step as "fulfil" | Action, id, send };
}

/** Exact decimal conversion; round sub-second fractions up, never down. */
export function parseFulfilMinutes(value: string): bigint {
  if (value.length > 64 || !/^(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)$/.test(value)) {
    throw new E2eError("--fulfil-in must be a decimal number of minutes, at least 1 minute.");
  }
  const [whole, fraction = ""] = value.split(".");
  if (BigInt(whole || "0") < 1n) throw new E2eError("--fulfil-in must be at least 1 minute.");
  const scale = 10n ** BigInt(fraction.length);
  const scaledMinutes = BigInt(whole || "0") * scale + BigInt(fraction || "0");
  const seconds = (scaledMinutes * 60n + scale - 1n) / scale;
  if (seconds > MAX_UINT64) throw new E2eError("--fulfil-in exceeds the uint64 deadline range.");
  return seconds;
}

export function fulfilByFrom(now: bigint, seconds = 3600n): bigint {
  if (seconds < 60n) throw new E2eError("--fulfil-in must be at least 1 minute.");
  if (now < 0n || seconds > MAX_UINT64 || now > MAX_UINT64 - seconds) {
    throw new E2eError("Timestamp cannot represent the requested uint64 fulfilment deadline.");
  }
  return now + seconds;
}

export function utcTime(timestamp: bigint): string {
  if (timestamp < 0n || timestamp > 8_640_000_000_000n) {
    throw new E2eError("fulfilBy cannot be represented as a UTC date; choose a smaller --fulfil-in value.");
  }
  return new Date(Number(timestamp) * 1000).toISOString();
}

export const SELLER_SETUP = "seller needs: register (npm run window -- register --index 1) and a window (npm run window -- open --index 1)";

export function sellerReadyForSend(
  status: { registered: boolean; algorithmId: number; publicKeyLength: number },
  window: { live: boolean; remainingTxs: bigint; remainingBlocks: bigint },
): boolean {
  return status.registered && status.algorithmId === 1 && status.publicKeyLength === 2592 &&
    window.live && window.remainingTxs > 0n && window.remainingBlocks > 0n;
}

/** Use the latest block timestamp (seconds), not the machine's wall clock. */
export function oneHourFrom(now: bigint): bigint {
  if (now < 0n || now > MAX_UINT64 - 3600n) throw new E2eError("Timestamp cannot represent a one-hour uint64 deadline.");
  return now + 3600n;
}

export function actionCode(action: Action): 1 | 2 {
  return action === "release" ? 1 : 2;
}

export interface DigestInput {
  chainId: bigint;
  contract: Address;
  id: bigint;
  action: Action;
  buyer: Address;
  seller: Address;
  amount: bigint;
  termsHash: Hex;
  validUntil: bigint;
}

/** ABI types/order exactly match Rewind._digest; this is a cross-check only. */
export function computeDigest(input: DigestInput): Hex {
  return keccak256(encodeAbiParameters(
    parseAbiParameters("string,uint256,address,uint256,uint8,address,address,uint256,bytes32,uint256"),
    ["REWIND_V1", input.chainId, input.contract, input.id, actionCode(input.action),
      input.buyer, input.seller, input.amount, input.termsHash, input.validUntil],
  ));
}

export function signatureSummary(signature: Uint8Array): { length: number; prefix: Hex } {
  return { length: signature.length, prefix: toHex(signature.subarray(0, 8)) };
}
