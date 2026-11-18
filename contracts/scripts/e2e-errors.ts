import { decodeErrorResult, formatEther, getAddress, isAddress, isHex, zeroAddress, type Abi, type Address } from "viem";
import { E2eError } from "./e2e-utils.js";

type Category =
  | "ENV_MISSING" | "ENV_INVALID" | "ADDRESS_MISMATCH" | "INSUFFICIENT_FUNDS"
  | "RPC_UNREACHABLE" | "RPC_REQUEST_FAILED" | "RPC_REJECTED"
  | "SIMULATION_REVERTED" | "CONTRACT_REVERTED" | "INPUT" | "UNEXPECTED";
type VariableName = "QORE_MNEMONIC" | "SELLER_ADDRESS";
export type Operation = "connection" | "read" | "simulation" | "gas estimation" | "broadcast" | "receipt";

export class DiagnosticError extends E2eError {
  constructor(readonly category: Category, message: string) { super(message); }
}

export interface FailureContext {
  abi?: Abi;
  endpoint?: string;
  operation?: Operation;
  address?: Address;
  balance?: bigint;
}

export function requiredVariable(name: VariableName, value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) throw new DiagnosticError("ENV_MISSING", `Required environment variable: ${name}.`);
  return trimmed;
}

export function invalidVariable(name: VariableName): DiagnosticError {
  return new DiagnosticError("ENV_INVALID", `Invalid environment variable: ${name}.`);
}

export function sellerAddressStatus(derived: Address, configured: string | undefined) {
  const value = configured?.trim();
  const set = Boolean(value);
  const valid = Boolean(value && isAddress(value) && getAddress(value) !== zeroAddress);
  const address = valid ? getAddress(value!) : undefined;
  return { set, valid, address, matches: address !== undefined && address === getAddress(derived) };
}

export function sellerMismatch(derived: Address, configured: Address): DiagnosticError {
  return new DiagnosticError("ADDRESS_MISMATCH",
    `Derived seller (index 1): ${getAddress(derived)}; SELLER_ADDRESS: ${getAddress(configured)}. No transaction sent.`);
}

export function insufficientFunds(address: Address, balance: bigint): DiagnosticError {
  return new DiagnosticError("INSUFFICIENT_FUNDS",
    `Account ${getAddress(address)} balance: ${formatEther(balance)} QOR (${balance} wei). Insufficient funds for value plus gas.`);
}

// Never take a URL, message, reason, details, body or formatted arguments from
// an error into output. Only the configured endpoint's hostname is exposed.
export function endpointHost(endpoint: string | undefined): string {
  try { return new URL(endpoint ?? "").hostname || "configured RPC host"; }
  catch { return "configured RPC host"; }
}

function errorNodes(error: unknown): Record<string, unknown>[] {
  const queue = [error];
  const seen = new Set<object>();
  const nodes: Record<string, unknown>[] = [];
  while (queue.length > 0 && nodes.length < 32) {
    const next = queue.shift();
    if (next === null || typeof next !== "object" || seen.has(next)) continue;
    seen.add(next);
    const node = next as Record<string, unknown>;
    nodes.push(node);
    // These contain structured RPC/viem error metadata, not request bodies.
    for (const field of ["cause", "data", "error", "originalError"]) queue.push(node[field]);
  }
  return nodes;
}

function customErrorName(nodes: Record<string, unknown>[], abi: Abi | undefined): string | undefined {
  if (!abi) return undefined;
  const names = new Set(abi.filter((item) => item.type === "error").map((item) => item.name));
  for (const node of nodes) {
    // ContractFunctionRevertedError.data already holds the decoded error name.
    if (typeof node.errorName === "string" && names.has(node.errorName)) return node.errorName;
    // RawContractError, RpcRequestError and ContractFunctionRevertedError.raw.
    for (const candidate of [node.data, node.raw]) {
      if (typeof candidate !== "string" || !isHex(candidate)) continue;
      try {
        const decoded = decodeErrorResult({ abi, data: candidate });
        if (names.has(decoded.errorName)) return decoded.errorName;
      } catch { /* Not recognized Rewind revert data. Never expose it. */ }
    }
  }
  return undefined;
}

const TRANSPORT_NAMES = new Set(["HttpRequestError", "WebSocketRequestError", "TimeoutError", "SocketClosedError", "AbortError"]);
const TRANSPORT_CODES = new Set([
  "ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "EAI_AGAIN", "ETIMEDOUT", "ENETUNREACH", "EHOSTUNREACH",
  "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_SOCKET",
]);

/** Categorize by structured metadata only; never echo provider error strings. */
export function categorizeFailure(error: unknown, context: FailureContext = {}): DiagnosticError {
  if (error instanceof DiagnosticError) return error;
  if (error instanceof E2eError) return new DiagnosticError("INPUT", error.message);
  const nodes = errorNodes(error);
  const name = customErrorName(nodes, context.abi);
  const simulation = context.operation === "simulation";
  if (name) return new DiagnosticError(simulation ? "SIMULATION_REVERTED" : "CONTRACT_REVERTED", `Rewind custom error: ${name}.`);
  if (nodes.some((node) => node.name === "InsufficientFundsError")) {
    if (context.address && context.balance !== undefined) return insufficientFunds(context.address, context.balance);
    return new DiagnosticError("INSUFFICIENT_FUNDS", "Insufficient gas funds; current balance is unavailable.");
  }
  const host = endpointHost(context.endpoint);
  const httpFailure = nodes.find((node) => node.name === "HttpRequestError" &&
    typeof node.status === "number" && Number.isInteger(node.status) && node.status >= 100 && node.status <= 599);
  if (httpFailure) {
    return new DiagnosticError("RPC_REJECTED", `RPC host ${host} returned HTTP ${httpFailure.status}. Raw response details are suppressed.`);
  }
  if (nodes.some((node) => TRANSPORT_NAMES.has(String(node.name)) || TRANSPORT_CODES.has(String(node.code)))) {
    return new DiagnosticError("RPC_UNREACHABLE", `Could not reach RPC host ${host}.`);
  }
  if (nodes.some((node) => node.name === "ContractFunctionRevertedError" || node.name === "ExecutionRevertedError" || node.code === 3)) {
    return new DiagnosticError(simulation ? "SIMULATION_REVERTED" : "CONTRACT_REVERTED", "Contract reverted; no recognized Rewind custom error name was available.");
  }
  if (nodes.some((node) => node.name === "RpcRequestError" || (typeof node.code === "number" && node.code < 0))) {
    return new DiagnosticError("RPC_REJECTED", `RPC host ${host} rejected the request. Raw provider details are suppressed.`);
  }
  if (!context.endpoint && !context.operation) {
    return new DiagnosticError("UNEXPECTED", "E2E step failed without structured diagnostic metadata; raw details are suppressed.");
  }
  return new DiagnosticError("RPC_REQUEST_FAILED", `${context.operation ?? "E2E"} request failed at ${host}; no structured diagnostic was available.`);
}

export function formatFailure(error: unknown, context: FailureContext = {}): string {
  const failure = categorizeFailure(error, context);
  return `[${failure.category}] ${failure.message}`;
}

export async function diagnose<T>(work: () => Promise<T>, context: FailureContext): Promise<T> {
  try { return await work(); }
  catch (error) {
    const failure = categorizeFailure(error, context);
    const caution = context.operation === "broadcast"
      ? " Broadcast outcome may be unknown; check on-chain history before retrying. No automatic retry was made."
      : context.operation === "receipt" ? " Check the printed transaction hash before repeating a step." : "";
    throw new DiagnosticError(failure.category, failure.message + caution);
  }
}
