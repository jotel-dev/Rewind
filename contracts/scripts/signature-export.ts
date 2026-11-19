import { isHex, size, toHex, type Hex } from "viem";
import { E2eError, MAX_UINT256, type Action } from "./e2e-utils.js";

/** Only public, scoped authorisation data is serialized; no signing credential. */
export function signatureExport(id: bigint, action: Action, validUntil: bigint, digest: Hex, signature: Uint8Array) {
  if (id <= 0n || id > MAX_UINT256 || validUntil <= 0n || validUntil > MAX_UINT256 ||
      !isHex(digest, { strict: true }) || size(digest) !== 32 || signature.length !== 4627 ||
      (action !== "release" && action !== "refund")) throw new E2eError("Invalid signature export metadata or signature length.");
  return { id: id.toString(), action, validUntil: validUntil.toString(), digest, signature: toHex(signature) };
}

export function signatureFilename(id: bigint, action: Action): string {
  if (id <= 0n || id > MAX_UINT256 || (action !== "release" && action !== "refund")) throw new E2eError("Invalid signature filename metadata.");
  return `signature-${id}-${action}.json`;
}
