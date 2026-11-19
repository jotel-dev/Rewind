import { getAddress, isAddress } from "viem";
import { E2eError } from "./e2e-utils.js";

export type WindowCommand = "status" | "register" | "open" | "recovery-code";

export function parseWindowArgs(argv: readonly string[]): { command: WindowCommand; index: number } {
  let command: WindowCommand | undefined;
  let index: number | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--index") {
      if (index !== undefined) throw new E2eError("--index cannot be repeated.");
      const raw = argv[++i];
      if (raw === undefined || !/^[0-9]+$/.test(raw)) {
        throw new E2eError("--index requires a nonnegative integer (0 to 2147483647).");
      }
      index = Number(raw);
      if (!Number.isSafeInteger(index) || index > 0x7fffffff) {
        throw new E2eError("--index must be between 0 and 2147483647.");
      }
    } else if ((arg === "status" || arg === "register" || arg === "open" || arg === "recovery-code") && command === undefined) {
      command = arg;
    } else throw new E2eError("Use: status | register | open [--index n], or recovery-code without an index.");
  }
  if (command === "recovery-code" && index !== undefined) throw new E2eError("--index is supported only for status, register and open.");
  return { command: command ?? "status", index: index ?? 0 };
}

export function assertIndexSource(index: number, hasMnemonic: boolean): void {
  if (index !== 0 && !hasMnemonic) {
    throw new E2eError("A nonzero --index requires QORE_MNEMONIC; PRIVATE_KEY does not support HD account selection.");
  }
}

export function assertSelectedSeller(index: number, derived: string, configured: string | undefined): void {
  if (index !== 1 || !configured?.trim()) return;
  const value = configured.trim();
  if (!isAddress(value)) throw new E2eError("SELLER_ADDRESS must be a valid EVM address when --index 1 is used.");
  if (getAddress(derived) !== getAddress(value)) {
    throw new E2eError(`Derived index-1 address ${getAddress(derived)} does not match SELLER_ADDRESS ${getAddress(value)}. No native transaction sent.`);
  }
}
