import { pathToFileURL } from "node:url";
import {
  deriveUnifiedAccount, fetchPqcStatus, isRegisteredPqcKey, pqcSign, type UnifiedAccount,
} from "@qorechain/sdk";
import {
  QORECHAIN_REST_ENDPOINTS, evmWindowCost, evmWindowStatus, qorechainTestnet,
} from "@qorechain/evm";
import {
  createPublicClient, createWalletClient, decodeErrorResult, decodeFunctionResult, defineChain,
  encodeFunctionData, getAddress, hexToBytes, http, isAddress, isHex,
  parseAbi, parseEventLogs, toHex, zeroAddress, type Address, type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { qorechainTestnetNetwork } from "../networks.js";
import {
  actionCode, computeDigest, DEMO_AMOUNT, DEMO_TERMS_HASH, E2eError, oneHourFrom,
  parseArgs, REWIND_ADDRESS, signatureSummary, STATE_NAMES, type Action,
} from "./e2e-utils.js";

export const ABI = parseAbi([
  "function createAgreement(address seller, bytes32 termsHash, uint64 fulfilBy) payable returns (uint256 id)",
  "function markFulfilled(uint256 id)",
  "function release(uint256 id, uint256 validUntil, bytes pqSignature)",
  "function refund(uint256 id, uint256 validUntil, bytes pqSignature)",
  "function getAgreement(uint256 id) view returns ((address buyer, address seller, uint256 amount, bytes32 termsHash, uint64 fulfilBy, uint8 state) agreement)",
  "function digestFor(uint256 id, uint8 action, uint256 validUntil) view returns (bytes32)",
  "event AgreementCreated(uint256 indexed id, address indexed buyer, address indexed seller, uint256 amount, bytes32 termsHash, uint64 fulfilBy)",
  "error ZeroAmount()", "error InvalidSeller()", "error InvalidDeadline()", "error AgreementNotFound()",
  "error OnlyBuyer()", "error OnlySeller()", "error InvalidState()", "error FulfilmentDeadlinePassed()",
  "error RefundNotAvailable()", "error AuthorizationExpired()", "error PqcKeyNotRegistered()",
  "error PqcPossessionNotProven()", "error UnsupportedPqcAlgorithm()", "error InvalidPqcPublicKey()",
  "error InvalidPqcSignature()", "error InvalidAction()", "error PaymentFailed()", "error ReentrantCall()",
]);

// Build with the local viem types instead of carrying optional hooks typed by
// the adapter's different viem version. Public metadata and endpoints are shared.
const chain = defineChain({
  id: qorechainTestnetNetwork.chainId,
  name: qorechainTestnet.name,
  nativeCurrency: qorechainTestnet.nativeCurrency,
  rpcUrls: { default: { http: [qorechainTestnetNetwork.url] } },
  testnet: true,
});

// Extract only a known custom-error name. Raw RPC errors can contain the entire
// signature/calldata, so they must never reach logs or an uncaught stack trace.
function revertName(error: unknown): string | undefined {
  let current = error;
  for (let depth = 0; depth < 8 && current !== null && typeof current === "object"; depth++) {
    const candidate = current as { data?: unknown; cause?: unknown };
    if (typeof candidate.data === "string" && isHex(candidate.data)) {
      try { return decodeErrorResult({ abi: ABI, data: candidate.data }).errorName; } catch { /* no known error */ }
    }
    current = candidate.cause;
  }
  return undefined;
}

function configuredSeller(): Address {
  const value = process.env.SELLER_ADDRESS?.trim();
  if (!value || !isAddress(value) || getAddress(value) === zeroAddress) {
    throw new E2eError("Set SELLER_ADDRESS to a valid nonzero EVM seller address.");
  }
  return getAddress(value);
}

async function signingAccount(index: 0 | 1): Promise<UnifiedAccount> {
  const mnemonic = process.env.QORE_MNEMONIC?.trim();
  if (!mnemonic) throw new E2eError("QORE_MNEMONIC is required for transaction steps.");
  try {
    // Exactly the window.ts derivation, with the requested buyer/seller index.
    return await deriveUnifiedAccount(mnemonic, index);
  } catch {
    throw new E2eError("Could not derive the signer. Check QORE_MNEMONIC locally; no credential details are logged.");
  }
}

async function main(): Promise<void> {
  const command = parseArgs(process.argv.slice(2));
  if ((process.env.QORE_NETWORK ?? "testnet") !== "testnet") {
    throw new E2eError("This runner supports QoreChain testnet only.");
  }
  // No Hardhat import, environment-file access, deployment, or automatic retry.
  const transport = () => http(qorechainTestnetNetwork.url, { retryCount: 0 });
  const client = createPublicClient({ chain, transport: transport() });
  if (await client.getChainId() !== 9800) throw new E2eError("RPC chain ID is not 9800. Stopping.");
  const code = await client.getCode({ address: REWIND_ADDRESS });
  if (!code || code === "0x") throw new E2eError("No contract code exists at the configured Rewind deployment.");

  async function agreement(id: bigint, blockNumber?: bigint) {
    return client.readContract({ address: REWIND_ADDRESS, abi: ABI, functionName: "getAgreement", args: [id], blockNumber });
  }

  async function digest(id: bigint, action: Action, validUntil: bigint) {
    const current = await agreement(id);
    const value = await client.readContract({
      address: REWIND_ADDRESS, abi: ABI, functionName: "digestFor", args: [id, actionCode(action), validUntil],
    });
    if (value !== computeDigest({
      chainId: 9800n, contract: REWIND_ADDRESS, id, action, buyer: current.buyer,
      seller: current.seller, amount: current.amount, termsHash: current.termsHash, validUntil,
    })) throw new E2eError("On-chain digest differs from the expected Rewind V1 payload. Stopping.");
    return value;
  }

  if (command.step === "state") {
    const [current, balance] = await Promise.all([
      agreement(command.id), client.getBalance({ address: REWIND_ADDRESS }),
    ]);
    console.log(`agreement ID: ${command.id}`);
    console.log(`buyer: ${current.buyer}`);
    console.log(`seller: ${current.seller}`);
    console.log(`amount (wei): ${current.amount}`);
    console.log(`termsHash: ${current.termsHash}`);
    console.log(`fulfilBy: ${current.fulfilBy}`);
    console.log(`state: ${STATE_NAMES[current.state] ?? "Unknown"}`);
    console.log(`contract balance (wei): ${balance}`);
    return;
  }

  const now = (await client.getBlock()).timestamp;
  if (command.step === "digest") {
    const validUntil = oneHourFrom(now);
    console.log(`validUntil: ${validUntil}`);
    console.log(`digest: ${await digest(command.id, command.action, validUntil)}`);
    return;
  }

  const role = command.step === "fulfil" ? "Seller (index 1)" : "Buyer (index 0)";
  const signer = await signingAccount(command.step === "fulfil" ? 1 : 0);
  const sender = getAddress(signer.evm);
  let data: Hex;
  let value = 0n;
  let id: bigint | undefined;
  let nextState: string;

  if (command.step === "create") {
    const seller = configuredSeller();
    if (seller === sender) throw new E2eError("SELLER_ADDRESS must differ from the buyer.");
    const fulfilBy = oneHourFrom(now);
    value = DEMO_AMOUNT;
    data = encodeFunctionData({ abi: ABI, functionName: "createAgreement", args: [seller, DEMO_TERMS_HASH, fulfilBy] });
    nextState = "Funded";
    console.log(`amount (wei): ${value}`);
    console.log(`fulfilBy: ${fulfilBy}`);
  } else {
    id = command.id;
    const current = await agreement(id);
    console.log(`current state: ${STATE_NAMES[current.state] ?? "Unknown"}`);
    if (command.step === "fulfil") {
      if (sender !== configuredSeller()) {
        throw new E2eError("Seller account at m/44'/60'/0'/0/1 does not match SELLER_ADDRESS. No transaction sent.");
      }
      if (sender !== getAddress(current.seller)) throw new E2eError("Index-1 seller does not match the agreement's stored seller.");
      data = encodeFunctionData({ abi: ABI, functionName: "markFulfilled", args: [id] });
      nextState = "Fulfilled";
    } else {
      if (sender !== getAddress(current.buyer)) throw new E2eError("Index-0 buyer does not match the agreement's stored buyer.");
      if (command.step === "refund" && now <= current.fulfilBy) {
        throw new E2eError("Refund is not available yet: the chain timestamp must be greater than fulfilBy.");
      }
      const validUntil = oneHourFrom(now);
      const message = await digest(id, command.step, validUntil);
      const signature = pqcSign(signer.pqc.secretKey, hexToBytes(message));
      const summary = signatureSummary(signature);
      if (summary.length !== 4627) throw new E2eError("SDK signature length is not 4,627 bytes. Stopping.");
      console.log(`validUntil: ${validUntil}`);
      console.log(`digest: ${message}`);
      console.log(`signature length: ${summary.length} bytes`);
      console.log(`signature first 8 bytes: ${summary.prefix}`);
      data = encodeFunctionData({ abi: ABI, functionName: command.step, args: [id, validUntil, toHex(signature)] });
      nextState = command.step === "release" ? "Released" : "Refunded";
    }
  }

  let simulated: Hex | undefined;
  try {
    simulated = (await client.call({ account: sender, to: REWIND_ADDRESS, data, value })).data;
    console.log("simulation: succeeded");
  } catch (error) {
    console.log("simulation: failed");
    const name = revertName(error);
    throw new E2eError(`${role} simulation failed${name ? ` (${name})` : ""}. Check agreement state, deadlines and PQC authorization. The sender also needs its own funding and live EVM window. No transaction sent.`);
  }

  if (!command.send) {
    if (command.step === "create") {
      if (!simulated) throw new E2eError("Simulation did not return an agreement ID.");
      console.log(`predicted agreement ID (not created): ${decodeFunctionResult({ abi: ABI, functionName: "createAgreement", data: simulated })}`);
    }
    console.log(`predicted state: ${nextState}`);
    console.log("transaction: not sent (simulation only)");
    console.log(`${role} still needs funding, a registered matching ML-DSA-87 key and a live EVM window before sending; eth_call does not establish those allowances.`);
    return;
  }

  // Read-only readiness checks. Never fund, register, open a window or fall back
  // to a different signer. Each invocation can broadcast at most one transaction.
  const rest = QORECHAIN_REST_ENDPOINTS[9800];
  const [window, pqc, balance] = await Promise.all([
    evmWindowStatus({ rest, address: signer.cosmos }),
    fetchPqcStatus({ rest, address: signer.cosmos }),
    client.getBalance({ address: sender }),
  ]);
  if (!pqc.registered) throw new E2eError(`${role} needs its own registered ML-DSA-87 key. No transaction sent.`);
  if (isRegisteredPqcKey(pqc, signer.pqc.publicKey) !== true) {
    throw new E2eError(`${role} registered key could not be confirmed to match its mnemonic-derived key. No transaction sent.`);
  }
  if (!window.live || window.remainingTxs < 1n || window.remainingBlocks < 1n) {
    throw new E2eError(`${role} needs its own live EVM window with remaining transactions. No transaction sent.`);
  }
  if (window.nativeOnly || (window.allowedTargets.length > 0 && !window.allowedTargets.some((target) => target.toLowerCase() === REWIND_ADDRESS.toLowerCase()))) {
    throw new E2eError(`${role} EVM window does not permit calls to this Rewind contract. No transaction sent.`);
  }
  if (balance <= value) throw new E2eError(`${role} needs testnet QOR to cover value plus gas. No transaction sent.`);
  const fees = await client.estimateFeesPerGas();
  let estimated: bigint;
  try {
    estimated = await client.estimateGas({ account: sender, to: REWIND_ADDRESS, data, value, ...fees });
  } catch {
    throw new E2eError(`${role} gas estimation failed. Check funding and its EVM window. No transaction sent.`);
  }
  const gas = (estimated * 120n + 99n) / 100n;
  const costWei = value + gas * fees.maxFeePerGas;
  if (balance < costWei) throw new E2eError(`${role} needs more testnet QOR for the maximum transaction cost. No transaction sent.`);
  if (window.remainingValue < evmWindowCost({ value, gas, maxFeePerGas: fees.maxFeePerGas })) {
    throw new E2eError(`${role} EVM window has insufficient value-plus-fee allowance. No transaction sent.`);
  }
  console.log(`window transactions remaining before send: ${window.remainingTxs}`);
  console.log(`estimated gas: ${estimated}`);
  const wallet = createWalletClient({
    account: privateKeyToAccount(signer.privateKey as Hex), chain, transport: transport(),
  });
  let hash: Hex;
  try {
    hash = await wallet.sendTransaction({ chain, to: REWIND_ADDRESS, data, value, gas, ...fees });
  } catch {
    throw new E2eError(`${role} broadcast failed or its outcome is unknown. Check funding, window and on-chain history before retrying; no automatic retry was made.`);
  }
  console.log(`transaction hash: ${hash}`);
  let receipt;
  try {
    receipt = await client.waitForTransactionReceipt({ hash, timeout: 120_000 });
  } catch {
    throw new E2eError("Receipt unavailable. Use the printed hash to check the transaction; do not blindly repeat a transaction step.");
  }
  console.log(`gas used: ${receipt.gasUsed}`);
  if (receipt.status !== "success") throw new E2eError("Transaction reverted on-chain. Gas and window allowances may have been consumed.");
  if (command.step === "create") {
    const events = parseEventLogs({
      abi: ABI, eventName: "AgreementCreated",
      logs: receipt.logs.filter((log) => log.address.toLowerCase() === REWIND_ADDRESS.toLowerCase()),
    });
    if (events.length !== 1) throw new E2eError("Transaction mined but creation ID was not identified. Inspect the printed hash before doing anything else.");
    id = events[0].args.id;
  }
  if (id === undefined) throw new E2eError("Missing agreement ID after transaction.");
  console.log(`agreement ID: ${id}`);
  console.log(`new state: ${STATE_NAMES[(await agreement(id, receipt.blockNumber)).state] ?? "Unknown"}`);
}

// Importing pure helpers/tests never starts the testnet runner or loads .env.
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof E2eError ? error.message : "E2E step failed. Check the testnet connection and configuration; raw errors are suppressed to protect signing data.");
    process.exitCode = 1;
  });
}
