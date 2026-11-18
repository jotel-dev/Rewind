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
  | { step: "create"; send: boolean }
  | { step: "fulfil" | Action; id: bigint; send: boolean }
  | { step: "digest"; id: bigint; action: Action }
  | { step: "state"; id: bigint };

/** Strict parsing avoids accidental sending from misspelled/contradictory flags. */
export function parseArgs(argv: readonly string[]): E2eCommand {
  const flags = argv.filter((arg) => arg.startsWith("--"));
  const args = argv.filter((arg) => !arg.startsWith("--"));
  if (flags.some((flag) => flag !== "--dry" && flag !== "--send") || new Set(flags).size !== flags.length) {
    throw new E2eError("Unknown or repeated flag. Use --dry or --send.");
  }
  if (flags.includes("--dry") && flags.includes("--send")) {
    throw new E2eError("--dry and --send cannot be combined.");
  }
  const step = args[0];
  if (!["create", "fulfil", "digest", "release", "refund", "state"].includes(step)) {
    throw new E2eError("Usage: e2e.ts create | fulfil <id> | digest <id> <release|refund> | release <id> | refund <id> | state <id>");
  }
  const expected = step === "create" ? 1 : step === "digest" ? 3 : 2;
  if (args.length !== expected) throw new E2eError("Wrong argument count for this step.");
  if ((step === "digest" || step === "state") && flags.length !== 0) {
    throw new E2eError("Read-only steps do not accept --send or --dry.");
  }
  const send = flags.includes("--send") || (!flags.includes("--dry") && (step === "create" || step === "fulfil"));
  if (step === "create") return { step, send };
  if (!/^[0-9]+$/.test(args[1])) throw new E2eError("Agreement ID must be a positive uint256 integer.");
  const id = BigInt(args[1]);
  if (id === 0n || id > MAX_UINT256) throw new E2eError("Agreement ID must be a positive uint256 integer.");
  if (step === "digest") {
    const action = args[2];
    if (action !== "release" && action !== "refund") throw new E2eError("Digest action must be release or refund.");
    return { step, id, action };
  }
  if (step === "state") return { step, id };
  return { step: step as "fulfil" | Action, id, send };
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
