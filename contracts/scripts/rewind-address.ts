import { readFile } from "node:fs/promises";
import { getAddress, isAddress, zeroAddress, type Address } from "viem";
import { E2eError } from "./e2e-utils.js";

export function resolveRewindAddress(override: string | undefined, deployments: unknown): Address {
  const stored = deployments !== null && typeof deployments === "object"
    ? (deployments as Record<string, unknown>)["RewindModule#Rewind"] : undefined;
  const value = override === undefined ? stored : override.trim();
  if (typeof value !== "string" || !isAddress(value) || getAddress(value) === zeroAddress) {
    throw new E2eError("Missing or invalid Rewind address: set REWIND_ADDRESS or provide RewindModule#Rewind in ignition/deployments/chain-9800/deployed_addresses.json.");
  }
  return getAddress(value);
}

/** Read only the public Ignition address manifest; never an environment file. */
export async function loadRewindAddress(override: string | undefined): Promise<Address> {
  if (override !== undefined) return resolveRewindAddress(override, undefined);
  let deployments: unknown;
  try {
    deployments = JSON.parse(await readFile(new URL("../ignition/deployments/chain-9800/deployed_addresses.json", import.meta.url), "utf8"));
  } catch {
    throw new E2eError("Cannot read the testnet deployment address manifest; set REWIND_ADDRESS or check ignition/deployments/chain-9800/deployed_addresses.json.");
  }
  return resolveRewindAddress(undefined, deployments);
}
