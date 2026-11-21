import { useQuery } from "@tanstack/react-query";
import { parseAbi, type Address } from "viem";
import { CONTRACT, publicClient } from "./config.js";
import { rewindAbi } from "./abi/rewind.js";

export const eventAbi = parseAbi([
  "event AgreementCreated(uint256 indexed id, address indexed buyer, address indexed seller, uint256 amount, bytes32 termsHash, uint64 fulfilBy)",
  "event AgreementFulfilled(uint256 indexed id)", "event AgreementReleased(uint256 indexed id, address indexed seller, uint256 amount)",
  "event AgreementRefunded(uint256 indexed id, address indexed buyer, uint256 amount)",
]);
export const RECENT_BLOCKS = 20_000n;
export function useHead() {
  return useQuery({ queryKey: ["head", CONTRACT], queryFn: async () => {
    if (await publicClient.getChainId() !== 9800) throw new Error("Wrong RPC chain");
    return publicClient.getBlock();
  }, refetchInterval: 15000, retry: 1 });
}
export function useAgreement(id: bigint | undefined) {
  return useQuery({ queryKey: ["agreement", CONTRACT, id?.toString()], queryFn: () => publicClient.readContract({ address: CONTRACT, abi: rewindAbi, functionName: "getAgreement", args: [id!] }), enabled: id !== undefined, refetchInterval: 15000, retry: 1 });
}

export async function readRecentAgreements(limit?: number) {
  const history = await recentEvents();
  const ids = [...new Set([...history.logs].reverse().flatMap((log) => log.args.id === undefined ? [] : [log.args.id]))];
  const payments = await Promise.all(ids.slice(0, limit).map(async (id) => ({
    id,
    agreement: await publicClient.readContract({ address: CONTRACT, abi: rewindAbi, functionName: "getAgreement", args: [id] }),
  })));
  return { ...history, payments };
}

export function useRecentAgreements(limit?: number) {
  return useQuery({ queryKey: ["recent-agreements", CONTRACT, limit ?? "all"], queryFn: () => readRecentAgreements(limit), refetchInterval: 60000, retry: 1 });
}

/** Bound RPC log scans and show that coverage explicitly; no backend/indexer or invented rows. */
export async function recentEvents(id?: bigint, wallet?: Address) {
  const latest = await publicClient.getBlockNumber();
  const fromBlock = latest > RECENT_BLOCKS ? latest - RECENT_BLOCKS : 0n;
  const logs = [];
  for (let start = fromBlock; start <= latest; start += 2000n) {
    const end = start + 1999n > latest ? latest : start + 1999n;
    if (wallet) {
      const event = eventAbi[0];
      const [buyer, seller] = await Promise.all([
        publicClient.getLogs({ address: CONTRACT, event, args: { buyer: wallet }, fromBlock: start, toBlock: end }),
        publicClient.getLogs({ address: CONTRACT, event, args: { seller: wallet }, fromBlock: start, toBlock: end }),
      ]);
      logs.push(...buyer, ...seller);
    } else if (id === undefined) {
      logs.push(...await publicClient.getLogs({ address: CONTRACT, event: eventAbi[0], fromBlock: start, toBlock: end }));
    } else {
      const found = await publicClient.getLogs({ address: CONTRACT, events: eventAbi, fromBlock: start, toBlock: end });
      logs.push(...found.filter((log) => log.args.id === id));
    }
  }
  const unique = [...new Map(logs.map((log) => [`${log.transactionHash}:${log.logIndex}`, log])).values()];
  return { logs: unique.sort((a, b) => Number(a.blockNumber - b.blockNumber) || Number(a.logIndex - b.logIndex)), fromBlock, toBlock: latest };
}
