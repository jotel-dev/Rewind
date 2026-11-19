import { evmWindowStatus, type EvmWindowStatusOptions } from "@qorechain/evm";
import { isValidBech32 } from "@qorechain/sdk";
import { getAddress, isAddress, type Address } from "viem";

/** Undefined means absent or malformed, never proof of an unrestricted window. */
export interface WindowScopeReadback {
  nativeOnly?: boolean;
  allowedTargets?: Address[];
  validators?: Address[];
  stakingValidators?: string[];
  ibcReceivers?: string[];
  issues: string[];
}

export function parseWindowScope(body: unknown): WindowScopeReadback {
  const raw = body !== null && typeof body === "object" ? body as Record<string, unknown> : {};
  const result: WindowScopeReadback = { issues: [] };
  const fields = [
    ["nativeOnly", "native_only"], ["allowedTargets", "allowed_targets"],
    ["validators", "validators"], ["stakingValidators", "staking_validators"],
    ["ibcReceivers", "ibc_receivers"],
  ] as const;
  for (const [camel, snake] of fields) {
    const value = raw[snake] ?? raw[camel];
    if (value === undefined || value === null) {
      result.issues.push(`REST read-back omits ${camel}; its scope cannot be confirmed.`);
    } else if (camel === "nativeOnly") {
      if (typeof value === "boolean") result.nativeOnly = value;
      else result.issues.push("REST read-back has malformed nativeOnly; its scope cannot be confirmed.");
    } else if (!Array.isArray(value) || !value.every((item: unknown) => typeof item === "string")) {
      result.issues.push(`REST read-back has malformed ${camel}; its scope cannot be confirmed.`);
    } else if (camel === "allowedTargets" || camel === "validators") {
      if (value.every((item: string) => isAddress(item))) result[camel] = value.map((item: string) => getAddress(item));
      else result.issues.push(`REST read-back has malformed ${camel}; its scope cannot be confirmed.`);
    } else if (camel === "stakingValidators") {
      if (value.every((item: string) => isValidBech32(item, "qorvaloper"))) result.stakingValidators = value;
      else result.issues.push("REST read-back has malformed stakingValidators; its scope cannot be confirmed.");
    } else {
      // Only a count is displayed: arbitrary receiver strings never enter output.
      result.ibcReceivers = value;
    }
  }
  return result;
}

export function windowScopeLines(scope: WindowScopeReadback): string[] {
  return [
    ...(scope.nativeOnly === undefined ? [] : [`scope nativeOnly: ${scope.nativeOnly}`]),
    ...(scope.allowedTargets === undefined ? [] : [`scope allowedTargets: ${scope.allowedTargets.length ? scope.allowedTargets.join(", ") : "[] (any recipient)"}`]),
    ...(scope.validators === undefined ? [] : [`scope validators: ${scope.validators.length ? scope.validators.join(", ") : "[]"}`]),
    ...(scope.stakingValidators === undefined ? [] : [`scope stakingValidators: ${scope.stakingValidators.length ? scope.stakingValidators.join(", ") : "[]"}`]),
    ...(scope.ibcReceivers === undefined ? [] : [`scope ibcReceivers: ${scope.ibcReceivers.length} entries (receiver strings not printed)`]),
    ...scope.issues,
  ];
}

/** Capture field presence from the very same REST response the installed parser uses. */
export async function readWindowStatus(options: EvmWindowStatusOptions) {
  let raw: unknown;
  const fetcher = options.fetch ?? globalThis.fetch;
  const window = await evmWindowStatus({
    ...options,
    fetch: async (url) => {
      const response = await fetcher(url);
      return {
        ok: response.ok, status: response.status,
        json: async () => { raw = await response.json(); return raw; },
      };
    },
  });
  return { window, scope: parseWindowScope(raw) };
}
