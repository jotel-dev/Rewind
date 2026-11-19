import { decodeErrorResult, formatEther, getAddress, isHex, size, type Address, type Hex } from "viem";
import { classifyEvmWindowRejection } from "@qorechain/evm";
import { rewindAbi } from "./abi/rewind.js";

export const states = ["None", "Funded", "Fulfilled", "Released", "Refunded"] as const;
export type SettlementAction = "release" | "refund";
export type Agreement = { buyer: Address; seller: Address; amount: bigint; termsHash: Hex; fulfilBy: bigint; state: number };
export class InputError extends Error {}
export const short = (value: string, count = 6) => `${value.slice(0, count + 2)}…${value.slice(-count)}`;
export const qor = (amount: bigint) => formatEther(amount);
export const utc = (timestamp: bigint) => new Date(Number(timestamp) * 1000).toLocaleString("en-GB", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" }) + " UTC";
export const sameAddress = (a: string | undefined, b: string) => a?.toLowerCase() === b.toLowerCase();
export function paymentId(value: string): bigint | undefined {
  if (!/^[0-9]{1,78}$/.test(value)) return;
  const id = BigInt(value);
  return id > 0n && id < 1n << 256n ? id : undefined;
}

/** Never display provider messages: they may contain calldata or wallet request details. */
export function safeError(error: unknown): string {
  if (error instanceof InputError) return error.message;
  const window = classifyEvmWindowRejection(error);
  if (window) return ({ "no-window": "Open an EVM authorisation window for this account before sending.", "no-pqc-key": "Register this account's ML-DSA-87 key before sending.", exhausted: "The EVM window does not admit this transaction. Check its target, block, transaction and fee allowances.", invalid: "The chain refused the EVM window. Check its configuration." })[window];
  const queue = [error]; const visited = new Set<unknown>();
  for (let n = 0; queue.length && n < 30; n++) {
    const node = queue.shift();
    if (!node || typeof node !== "object" || visited.has(node)) continue;
    visited.add(node);
    const item = node as Record<string, unknown>;
    if (typeof item.errorName === "string" && rewindAbi.some((entry) => entry.type === "error" && entry.name === item.errorName)) return `The contract returned ${item.errorName}.`;
    if (item.code === 4001 || item.name === "UserRejectedRequestError") return "Request cancelled in your wallet. No confirmation was received.";
    if (item.code === 4902) return "Select QoreChain testnet (9800) in your wallet, then reconnect.";
    for (const data of [item.data, item.raw]) {
      if (typeof data === "string" && isHex(data)) {
        try { return `The contract returned ${decodeErrorResult({ abi: rewindAbi, data }).errorName}.`; } catch { /* Only ABI-recognized errors are shown. */ }
      }
    }
    queue.push(item.cause, item.error, item.data);
  }
  return "The request could not be completed. Check the testnet connection and wallet support, then retry. If a transaction was sent, check its hash before retrying.";
}

export interface ImportedSignature { signature: Hex; validUntil?: bigint; digest?: Hex; id?: bigint; action?: SettlementAction }
/** Accept only the public signature format. Never retain arbitrary pasted text. */
export function parseSignature(text: string, id: bigint, action: SettlementAction): ImportedSignature {
  if (text.length > 14000) throw new InputError("Paste only the exported signature JSON or the complete 0x signature.");
  const input = text.trim();
  let signature: unknown = input;
  let metadata: Omit<ImportedSignature, "signature"> = {};
  if (input.startsWith("{")) {
    let value: Record<string, unknown>;
    try { value = JSON.parse(input) as Record<string, unknown>; } catch { throw new InputError("The signature JSON is not valid."); }
    if (!value || Array.isArray(value) || Object.keys(value).sort().join(",") !== "action,digest,id,signature,validUntil") throw new InputError("Import only the five-field JSON from the sign command. Signing credentials are never accepted.");
    if (String(value.id) !== id.toString() || value.action !== action) throw new InputError("The signature file's agreement ID or action does not match this payment.");
    if (typeof value.validUntil !== "string" || !/^[0-9]{1,78}$/.test(value.validUntil) || BigInt(value.validUntil) <= 0n || BigInt(value.validUntil) >= 1n << 256n) throw new InputError("The signature file's expiry is invalid.");
    if (typeof value.digest !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(value.digest)) throw new InputError("The signature file must include its exact 32-byte digest.");
    signature = value.signature;
    metadata = { id, action, validUntil: BigInt(value.validUntil), digest: value.digest as Hex };
  }
  if (typeof signature !== "string" || !/^0x[0-9a-fA-F]{9254}$/.test(signature) || size(signature as Hex) !== 4627) throw new InputError("Expected a 4,627-byte 0x signature. Keys and phrases are never accepted.");
  return { ...metadata, signature: signature as Hex };
}

export function validatedParty(value: string): Address {
  try { return getAddress(value); } catch { throw new InputError("Enter a valid seller 0x address."); }
}
