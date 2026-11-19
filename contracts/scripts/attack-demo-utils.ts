import { classifyEvmWindowRejection, type EvmWindow } from "@qorechain/evm";
import { getAddress, type Address } from "viem";
import { E2eError, MAX_UINT256 } from "./e2e-utils.js";
import type { WindowScopeReadback } from "./window-scope.js";

export const ATTACK_DESCRIPTION = "a classical-key attack demonstration";
export const TRANSFER_TARGET: Address = "0x000000000000000000000000000000000000dEaD";
export const TRANSFER_WEI = 1_000_000_000_000n; // One uqor; fees are separate.
export type SignatureAttack = "release-forged" | "release-no-sig" | "refund-forged";
export type AttackCommand = { attack: SignatureAttack; id: bigint } | { attack: "transfer-out"; send: boolean };
export interface AttackResult { pass: boolean; message: string }

export function parseAttackArgs(argv: readonly string[]): AttackCommand {
  const flags = argv.filter((arg) => arg.startsWith("--"));
  const args = argv.filter((arg) => !arg.startsWith("--"));
  const attack = args[0];
  if (flags.some((flag) => flag !== "--send") || flags.length > 1) throw new E2eError("Unknown or repeated flag; only transfer-out accepts --send.");
  if (attack === "transfer-out") {
    if (args.length !== 1) throw new E2eError("Usage: attack-demo.ts transfer-out [--send]");
    return { attack, send: flags.includes("--send") };
  }
  if (attack !== "release-forged" && attack !== "release-no-sig" && attack !== "refund-forged") {
    throw new E2eError("Usage: attack-demo.ts release-forged [id] | release-no-sig [id] | refund-forged [id] | transfer-out [--send]");
  }
  if (flags.length || args.length > 2) throw new E2eError("Signature attacks simulate only and accept one optional agreement ID, with no flags.");
  const raw = args[1] ?? "1";
  if (!/^[0-9]+$/.test(raw)) throw new E2eError("Agreement ID must be a positive uint256 integer.");
  const id = BigInt(raw);
  if (id === 0n || id > MAX_UINT256) throw new E2eError("Agreement ID must be a positive uint256 integer.");
  return { attack, id };
}

export function assessSignatureAttack(
  attack: SignatureAttack, errorName: string | undefined,
  agreement: { state: number; fulfilBy: bigint }, now: bigint,
): AttackResult {
  if (errorName === "InvalidState") {
    return { pass: false, message: "InvalidState: the state check runs before the signature check; signature rejection was not tested. Release needs a Fulfilled agreement; refund needs a Funded agreement past its deadline." };
  }
  if (errorName === "RefundNotAvailable") {
    return { pass: false, message: "RefundNotAvailable: refund needs a Funded agreement strictly past fulfilBy; the deadline check runs before the signature check." };
  }
  const ready = attack === "refund-forged"
    ? agreement.state === 1 && now > agreement.fulfilBy : agreement.state === 2;
  if (errorName === "InvalidPqcSignature" && ready) {
    return { pass: true, message: "InvalidPqcSignature: Rewind rejected the invalid signature in eth_call; no transaction was sent." };
  }
  if (!ready) return { pass: false, message: "Agreement preconditions do not permit testing signature rejection; choose the appropriate state and deadline." };
  if (errorName) return { pass: false, message: `Rewind returned ${errorName}; expected InvalidPqcSignature, so signature rejection was not established.` };
  return { pass: false, message: "Simulation did not produce a recognized Rewind signature error; signature rejection was not established." };
}

export function assertScopedTransferReady(window: EvmWindow, scope: WindowScopeReadback, rewind: Address): void {
  if (!window.found || !window.live || window.remainingTxs < 1n || window.remainingBlocks < 1n || window.remainingValue <= 0n) {
    throw new E2eError("Buyer needs a live window with remaining allowances before testing target scoping; open one with npm run window -- open --scope-contract.");
  }
  if (scope.nativeOnly !== false || scope.allowedTargets === undefined || scope.allowedTargets.length !== 1 ||
      getAddress(scope.allowedTargets[0]) !== getAddress(rewind) || getAddress(rewind) === TRANSFER_TARGET) {
    throw new E2eError("REST read-back must explicitly confirm nativeOnly=false and allowedTargets=[Rewind]. Refusing to send with missing, malformed or different scope.");
  }
}

export function assessTransferRejection(error: unknown): AttackResult {
  // The installed classifier recognizes the chain's window-refusal strings/codes.
  // Classification reads provider text internally but never returns that text.
  const kind = classifyEvmWindowRejection(error);
  if (kind === "exhausted") {
    return { pass: true, message: "Chain rejected the broadcast with a recognized window refusal (exhausted). This reply alone does not distinguish target scoping from allowances changing after the readiness check." };
  }
  return { pass: false, message: kind
    ? `Window refusal category: ${kind}; target-scope enforcement was not established.`
    : "No recognized window refusal was returned; broadcast outcome may be unknown. Check account history before retrying; target-scope enforcement was not established." };
}
