import { parseAbi, type Address, type Hex } from "viem";
import { states } from "./lib.js";

// Public RewindModule#Rewind receipt in contracts/ignition/deployments/chain-9800/journal.jsonl.
export const DEFAULT_DEPLOY_BLOCK = 10_320_988n;
export const TIMELINE_CHUNK = 20_000n;
export const TIMELINE_SCAN_LIMIT = 600_000n;
export const TIMELINE_PARALLEL = 4;
export const eventAbi = parseAbi([
  "event AgreementCreated(uint256 indexed id, address indexed buyer, address indexed seller, uint256 amount, bytes32 termsHash, uint64 fulfilBy)",
  "event AgreementFulfilled(uint256 indexed id)",
  "event AgreementReleased(uint256 indexed id, address indexed seller, uint256 amount)",
  "event AgreementRefunded(uint256 indexed id, address indexed buyer, uint256 amount)",
]);
export type TimelineLog = {
  args: { id: bigint }; blockNumber: bigint; logIndex: number; transactionHash: Hex;
  eventName: typeof eventAbi[number]["name"];
};
type TimelineClient = {
  getBlockNumber: () => Promise<bigint>;
  getLogs: (request: { address: Address; event: typeof eventAbi[number]; args: { id: bigint }; fromBlock: bigint; toBlock: bigint; strict: true }) => Promise<TimelineLog[]>;
};
export type Timeline = {
  logs: TimelineLog[]; fromBlock: bigint; toBlock: bigint; scannedBlocks: bigint;
  creationFound: boolean; limitReached: boolean; deploymentKnown: boolean;
};

export function parseDeployBlock(value = DEFAULT_DEPLOY_BLOCK.toString()): bigint | undefined {
  const input = value.trim();
  if (input === "unknown") return undefined;
  if (!/^[0-9]{1,78}$/.test(input)) throw new Error("VITE_REWIND_DEPLOY_BLOCK must be a nonnegative decimal block number or unknown.");
  return BigInt(input);
}

async function retry<T>(read: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await read(); }
    catch (error) {
      if (attempt === 2) throw error;
      await new Promise<void>((resolve) => setTimeout(resolve, 100 * 2 ** attempt));
    }
  }
}

/** Snapshot the upper block, filter at the RPC, and never turn failed reads into empty history. */
export async function readTimeline(client: TimelineClient, contract: Address, id: bigint, deployBlock: bigint | undefined): Promise<Timeline> {
  const latest = await retry(() => client.getBlockNumber());
  if (deployBlock !== undefined && deployBlock > latest) throw new Error("The configured Rewind deployment block is newer than the RPC's latest block.");
  const backwards = deployBlock === undefined;
  const floor = deployBlock ?? (latest + 1n > TIMELINE_SCAN_LIMIT ? latest + 1n - TIMELINE_SCAN_LIMIT : 0n);
  let cursor = deployBlock ?? latest;
  let fromBlock = latest;
  let scannedBlocks = 0n;
  const logs: TimelineLog[] = [];
  let creationFound = false;
  while (cursor >= floor && cursor <= latest) {
    const ranges: { fromBlock: bigint; toBlock: bigint }[] = [];
    for (let index = 0; index < TIMELINE_PARALLEL && cursor >= floor && cursor <= latest; index++) {
      if (backwards) {
        const start = cursor - TIMELINE_CHUNK + 1n < floor ? floor : cursor - TIMELINE_CHUNK + 1n;
        ranges.push({ fromBlock: start, toBlock: cursor });
        cursor = start - 1n;
      } else {
        const end = cursor + TIMELINE_CHUNK - 1n > latest ? latest : cursor + TIMELINE_CHUNK - 1n;
        ranges.push({ fromBlock: cursor, toBlock: end });
        cursor = end + 1n;
      }
    }
    // Four chunks in parallel; the four event types within each chunk are read sequentially.
    // This keeps the total active getLogs requests at four, including retries.
    const batch = await Promise.allSettled(ranges.map(async (range) => {
      const found: TimelineLog[] = [];
      for (const event of eventAbi) {
        found.push(...await retry(() => client.getLogs({ address: contract, event, args: { id }, ...range, strict: true })));
      }
      return found.filter((log) => log.args.id === id);
    }));
    for (const result of batch) if (result.status === "rejected") throw result.reason;
    for (const [index, result] of batch.entries()) {
      if (result.status !== "fulfilled") continue;
      logs.push(...result.value);
      fromBlock = ranges[index].fromBlock < fromBlock ? ranges[index].fromBlock : fromBlock;
      scannedBlocks += ranges[index].toBlock - ranges[index].fromBlock + 1n;
    }
    creationFound = logs.some((log) => log.eventName === "AgreementCreated");
    if (backwards && creationFound) break;
  }
  const unique = [...new Map(logs.map((log) => [`${log.transactionHash}:${log.logIndex}`, log])).values()];
  unique.sort((a, b) => a.blockNumber < b.blockNumber ? -1 : a.blockNumber > b.blockNumber ? 1 : a.logIndex - b.logIndex);
  return { logs: unique, fromBlock, toBlock: latest, scannedBlocks, creationFound,
    limitReached: backwards && !creationFound && scannedBlocks === TIMELINE_SCAN_LIMIT, deploymentKnown: !backwards };
}

export function timelineInconsistency(logs: TimelineLog[], state: number): string | undefined {
  const expected: Record<number, TimelineLog["eventName"]> = { 1: "AgreementCreated", 2: "AgreementFulfilled", 3: "AgreementReleased", 4: "AgreementRefunded" };
  const last = logs.at(-1);
  if (!last) return `Timeline incomplete: getAgreement reports ${states[state] ?? "Unknown"}, but no events were returned.`;
  if (last.eventName !== expected[state]) return `Timeline inconsistency: getAgreement reports ${states[state] ?? "Unknown"}, but the latest event is ${last.eventName}. Refresh to check for a recent state change or missing events.`;
}
