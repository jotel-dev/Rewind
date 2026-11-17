import { pathToFileURL } from "node:url";
import { qorToEvm } from "@qorechain/sdk";
import {
  createPublicClient, decodeFunctionResult, encodeFunctionData, encodeFunctionResult,
  getAddress, http, isAddress, parseAbi, size, type Address, type Hex,
} from "viem";
import { qorechainTestnetNetwork } from "../networks.js";

const PQC_STATUS = "0x0000000000000000000000000000000000000a02";
const FOUR_OUTPUT_ABI = parseAbi([
  "function pqcKeyStatus(address account) view returns (bool registered, uint8 algorithmId, bytes pubkey, bool possessionProven)",
]);
const THREE_OUTPUT_ABI = parseAbi([
  "function pqcKeyStatus(address account) view returns (bool registered, uint8 algorithmId, bytes pubkey)",
]);

class ProbeError extends Error {}

export interface KeyStatusSummary {
  shape: "4-output" | "3-output";
  registered: boolean;
  algorithmId: number;
  publicKeyLength: number;
  possessionProven?: boolean;
}

export function normalizeAddress(input: string): Address {
  try {
    const hex = input.startsWith("qor1") ? qorToEvm(input) : input;
    if (!isAddress(hex)) throw new Error("invalid address");
    return getAddress(hex);
  } catch {
    throw new ProbeError("Provide a valid 20-byte 0x address or qor1 account address.");
  }
}

/** Decode without exposing the returned public key or raw ABI errors. */
export function decodeKeyStatus(data: Hex | undefined): KeyStatusSummary {
  if (data === undefined || data === "0x") {
    throw new ProbeError("Empty response: pqcKeyStatus may not be active on this endpoint.");
  }
  try {
    const result = decodeFunctionResult({ abi: FOUR_OUTPUT_ABI, functionName: "pqcKeyStatus", data });
    // A loose decoder can read a legacy empty key as possessionProven=false.
    // Require canonical four-output encoding before reporting that shape.
    if (encodeFunctionResult({ abi: FOUR_OUTPUT_ABI, functionName: "pqcKeyStatus", result }) !== data.toLowerCase()) {
      throw new Error("not canonical four-output data");
    }
    const [registered, algorithmId, pubkey, possessionProven] = result;
    return { shape: "4-output", registered, algorithmId, publicKeyLength: size(pubkey), possessionProven };
  } catch {
    try {
      const result = decodeFunctionResult({ abi: THREE_OUTPUT_ABI, functionName: "pqcKeyStatus", data });
      if (encodeFunctionResult({ abi: THREE_OUTPUT_ABI, functionName: "pqcKeyStatus", result }) !== data.toLowerCase()) {
        throw new Error("not canonical three-output data");
      }
      const [registered, algorithmId, pubkey] = result;
      return { shape: "3-output", registered, algorithmId, publicKeyLength: size(pubkey) };
    } catch {
      throw new ProbeError("Response could not be decoded as canonical four-output or three-output pqcKeyStatus data.");
    }
  }
}

async function main(): Promise<void> {
  if (process.argv.length !== 3) {
    throw new ProbeError("Usage: tsx --env-file=.env scripts/probe-pqc.ts <evm-or-qor1-address>");
  }
  // The sole environment variable this script reads. Never access signing secrets.
  if ((process.env.QORE_NETWORK ?? "testnet") !== "testnet") {
    throw new ProbeError("This probe supports QoreChain testnet only; QORE_NETWORK must select testnet.");
  }
  const account = normalizeAddress(process.argv[2]);
  // Do not import hardhat.config.ts: it loads environment files and declares accounts.
  const client = createPublicClient({ transport: http(qorechainTestnetNetwork.url) });
  const chainId = await client.getChainId();
  if (chainId !== qorechainTestnetNetwork.chainId) {
    throw new ProbeError("RPC chain ID does not match the configured QoreChain testnet.");
  }
  const { data } = await client.call({
    to: PQC_STATUS,
    data: encodeFunctionData({ abi: FOUR_OUTPUT_ABI, functionName: "pqcKeyStatus", args: [account] }),
  });
  // Both shapes use the same selector: decode the single eth_call response twice
  // if necessary, without sending a transaction or making a second state query.
  const summary = decodeKeyStatus(data);
  console.log(`chainId: ${chainId}`);
  console.log(`account: ${account}`);
  console.log(`ABI shape: ${summary.shape}`);
  console.log(`registered: ${summary.registered}`);
  console.log(`algorithmId: ${summary.algorithmId}`);
  console.log(`public key length: ${summary.publicKeyLength} bytes`);
  if (summary.possessionProven !== undefined) {
    console.log(`possessionProven: ${summary.possessionProven}`);
  } else {
    console.log("possessionProven: unavailable in the 3-output ABI");
  }
}

// Importing the decoder in offline tests must never start an RPC request.
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    // Raw provider/decoder errors may contain response data. Never print them.
    console.error(error instanceof ProbeError ? error.message : "PQC probe failed; check the testnet RPC connection and precompile availability.");
    process.exitCode = 1;
  });
}
