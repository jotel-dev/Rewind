import { createPublicClient, defineChain, getAddress, http, isAddress, zeroAddress } from "viem";

const configuredAddress = import.meta.env.VITE_REWIND_ADDRESS ?? "0x775BbF36986FaBC54b64955c1D9b8EdB388E7c20";
if (!isAddress(configuredAddress) || getAddress(configuredAddress) === zeroAddress) throw new Error("VITE_REWIND_ADDRESS must be a valid, nonzero contract address.");
export const CONTRACT = getAddress(configuredAddress);
export const RPC_URL = import.meta.env.VITE_RPC_URL ?? "https://evm-testnet.qore.host";
export const chain = defineChain({
  id: 9800, name: "QoreChain Testnet", nativeCurrency: { name: "QOR", symbol: "QOR", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } }, testnet: true,
  blockExplorers: { default: { name: "QoreChain Explorer", url: "https://dashboard.qorechain.io/explorer" } },
});
export const publicClient = createPublicClient({ chain, transport: http(RPC_URL, { retryCount: 0, timeout: 20_000 }) });
export const REPO = "https://github.com/jotel-dev/Rewind";
export const transactionUrl = (hash: string) => `https://dashboard.qorechain.io/explorer/tx/${hash}`;
export const addressUrl = (address: string) => `https://dashboard.qorechain.io/explorer/address/${address}`;
