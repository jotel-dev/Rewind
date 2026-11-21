import { ContractFunctionRevertedError, decodeErrorResult, isHex, type Address } from "viem";
import { rewindAbi } from "./abi/rewind.js";
import { sameAddress, type Agreement } from "./lib.js";

export const AGREEMENT_CAP = 500;
export const AGREEMENT_BATCH_SIZE = 10;
type AgreementClient = {
  readContract: (request: { address: Address; abi: typeof rewindAbi; functionName: "getAgreement"; args: readonly [bigint] }) => Promise<Agreement>;
};
export type AgreementRecord = { id: bigint; agreement: Agreement };
export type AgreementList = { payments: AgreementRecord[]; lastId: bigint; capped: boolean };

/** Only an ABI-recognized revert ends enumeration; provider messages never do. */
function agreementNotFound(error: unknown): boolean {
  const queue = [error];
  const visited = new Set<unknown>();
  while (queue.length && visited.size < 30) {
    const node = queue.shift();
    if (!node || typeof node !== "object" || visited.has(node)) continue;
    visited.add(node);
    if (node instanceof ContractFunctionRevertedError && node.data?.errorName === "AgreementNotFound") return true;
    const item = node as Record<string, unknown>;
    for (const data of [item.data, item.raw]) {
      if (typeof data !== "string" || !isHex(data)) continue;
      try {
        if (decodeErrorResult({ abi: rewindAbi, data }).errorName === "AgreementNotFound") return true;
      } catch { /* Unknown revert data is an error, never an empty list. */ }
    }
    queue.push(item.cause, item.error, item.data);
  }
  return false;
}

/** IDs are contiguous and never deleted. Read bounded batches without an event index. */
export async function enumerateAgreements(client: AgreementClient, contract: Address): Promise<AgreementList> {
  const payments: AgreementRecord[] = [];
  for (let start = 1; start <= AGREEMENT_CAP; start += AGREEMENT_BATCH_SIZE) {
    const ids = Array.from({ length: Math.min(AGREEMENT_BATCH_SIZE, AGREEMENT_CAP - start + 1) }, (_, index) => BigInt(start + index));
    const batch = await Promise.allSettled(ids.map((id) => client.readContract({ address: contract, abi: rewindAbi, functionName: "getAgreement", args: [id] })));
    // A failed RPC anywhere in the batch must not be presented as a successful empty/partial result.
    for (const result of batch) {
      if (result.status === "rejected" && !agreementNotFound(result.reason)) throw result.reason;
    }
    for (const [index, result] of batch.entries()) {
      if (result.status === "rejected") return { payments: payments.reverse(), lastId: ids[index] - 1n, capped: false };
      payments.push({ id: ids[index], agreement: result.value });
    }
  }
  return { payments: payments.reverse(), lastId: BigInt(AGREEMENT_CAP), capped: true };
}

export function walletAgreements(payments: AgreementRecord[], wallet: string): AgreementRecord[] {
  return payments.filter(({ agreement }) => sameAddress(wallet, agreement.buyer) || sameAddress(wallet, agreement.seller));
}

export function agreementCoverage({ lastId, capped }: AgreementList): string {
  const coverage = lastId === 0n ? "Read directly from the Rewind contract: no agreements found."
    : `Read directly from the Rewind contract: agreements 1 to ${lastId}.`;
  return coverage + (capped ? ` Read limit reached (${AGREEMENT_CAP} IDs); more agreements may exist.` : "");
}
