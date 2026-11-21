import { useQuery } from "@tanstack/react-query";
import { CONTRACT, DEPLOY_BLOCK, publicClient } from "./config.js";
import { rewindAbi } from "./abi/rewind.js";
import { enumerateAgreements } from "./agreements.js";
import { readTimeline } from "./timeline.js";

export function useHead() {
  return useQuery({ queryKey: ["head", CONTRACT], queryFn: async () => {
    if (await publicClient.getChainId() !== 9800) throw new Error("Wrong RPC chain");
    return publicClient.getBlock();
  }, refetchInterval: 15000, retry: 1 });
}
export function useAgreement(id: bigint | undefined) {
  return useQuery({ queryKey: ["agreement", CONTRACT, id?.toString()], queryFn: () => publicClient.readContract({ address: CONTRACT, abi: rewindAbi, functionName: "getAgreement", args: [id!] }), enabled: id !== undefined, refetchInterval: 15000, retry: 1 });
}

/** All lists share TanStack Query's in-memory cache, including disconnected views. */
export const agreementsQueryOptions = {
  queryKey: ["agreements", 9800, CONTRACT], queryFn: () => enumerateAgreements(publicClient, CONTRACT),
  staleTime: 60000, gcTime: 300000, refetchInterval: 60000, retry: 1,
};
export function useAgreements() {
  return useQuery(agreementsQueryOptions);
}

export function timelineQueryOptions(id: bigint | undefined) {
  return { queryKey: ["timeline", CONTRACT, id?.toString(), DEPLOY_BLOCK?.toString() ?? "unknown"],
    queryFn: () => readTimeline(publicClient, CONTRACT, id!, DEPLOY_BLOCK), enabled: id !== undefined,
    staleTime: 30000, gcTime: 300000, refetchInterval: 30000, retry: false as const };
}
export function useTimeline(id: bigint | undefined) {
  return useQuery(timelineQueryOptions(id));
}
