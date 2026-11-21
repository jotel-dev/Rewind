import { pathToFileURL } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
import {
  deriveUnifiedAccount, fetchPqcStatus, isRegisteredPqcKey, pqcSign, qoreAddresses, type UnifiedAccount,
} from "@qorechain/sdk";
import {
  QORECHAIN_REST_ENDPOINTS, evmWindowCost, evmWindowStatus, qorechainTestnet,
} from "@qorechain/evm";
import {
  createPublicClient, createWalletClient, decodeFunctionResult, defineChain,
  encodeFunctionData, formatEther, getAddress, hexToBytes, http, isAddress,
  parseAbi, parseEventLogs, toHex, zeroAddress, type Address, type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { qorechainTestnetNetwork } from "../networks.js";
import {
  actionCode, computeDigest, DEMO_AMOUNT, DEMO_TERMS_HASH, E2eError, fulfilByFrom, oneHourFrom,
  parseArgs, REWIND_ADDRESS, SELLER_SETUP, sellerReadyForSend, signatureSummary, STATE_NAMES, utcTime, type Action,
} from "./e2e-utils.js";
import { readPqcKeyStatus } from "./probe-pqc.js";
import { signatureExport, signatureFilename } from "./signature-export.js";
import { loadRewindAddress } from "./rewind-address.js";
import {
  DiagnosticError, diagnose, formatFailure, insufficientFunds, invalidVariable,
  requiredVariable, sellerAddressStatus, sellerMismatch, type FailureContext, type Operation,
} from "./e2e-errors.js";

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

/** Select public fields only, using the SDK's EVM-to-qor conversion for the contract too. */
export function publicAddressLines(
  buyer: Pick<UnifiedAccount, "evm" | "cosmos">,
  seller: Pick<UnifiedAccount, "evm" | "cosmos">,
  contract: Address,
): string[] {
  return [
    `buyer 0x: ${getAddress(buyer.evm)}`,
    `buyer qor1: ${buyer.cosmos}`,
    `seller index 1 0x: ${getAddress(seller.evm)}`,
    `seller index 1 qor1: ${seller.cosmos}`,
    `Rewind 0x: ${getAddress(contract)}`,
    `Rewind qor1: ${qoreAddresses({ evm: contract }).cosmos}`,
  ];
}

function configuredSeller(): Address {
  const value = requiredVariable("SELLER_ADDRESS", process.env.SELLER_ADDRESS);
  if (!isAddress(value) || getAddress(value) === zeroAddress) throw invalidVariable("SELLER_ADDRESS");
  return getAddress(value);
}

async function signingAccount(index: 0 | 1): Promise<UnifiedAccount> {
  const mnemonic = requiredVariable("QORE_MNEMONIC", process.env.QORE_MNEMONIC);
  try {
    // Exactly the window.ts derivation, with the requested buyer/seller index.
    return await deriveUnifiedAccount(mnemonic, index);
  } catch {
    throw invalidVariable("QORE_MNEMONIC");
  }
}

async function main(): Promise<void> {
  const command = parseArgs(process.argv.slice(2));
  if ((process.env.QORE_NETWORK ?? "testnet") !== "testnet") {
    throw new E2eError("This runner supports QoreChain testnet only.");
  }
  // Validate local credentials/address selection before any RPC access.
  const signer = "send" in command || command.step === "sign" ? await signingAccount(command.step === "fulfil" ? 1 : 0) : undefined;
  const selectedSeller = command.step === "create" || command.step === "fulfil" ? configuredSeller() : undefined;
  if (command.step === "fulfil" && getAddress(signer!.evm) !== selectedSeller) {
    throw sellerMismatch(getAddress(signer!.evm), selectedSeller!);
  }
  let derivedAccounts: { buyer: UnifiedAccount; seller: UnifiedAccount } | undefined;
  if (command.step === "addresses" || command.step === "balances") {
    const [buyer, seller] = await Promise.all([signingAccount(0), signingAccount(1)]);
    derivedAccounts = { buyer, seller };
    if (command.step === "addresses") {
      const status = sellerAddressStatus(getAddress(seller.evm), process.env.SELLER_ADDRESS);
      const contract = await loadRewindAddress(undefined);
      for (const line of publicAddressLines(buyer, seller, contract)) console.log(line);
      console.log(`SELLER_ADDRESS set: ${status.set}`);
      console.log(`SELLER_ADDRESS valid: ${status.valid}`);
      console.log(`SELLER_ADDRESS matches: ${status.matches}`);
      return;
    }
  }
  // No Hardhat import, environment-file access, deployment, or automatic retry.
  const transport = () => http(qorechainTestnetNetwork.url, { retryCount: 0 });
  const client = createPublicClient({ chain, transport: transport() });
  const remote = <T>(operation: Operation, work: () => Promise<T>, extra: Partial<FailureContext> = {}) =>
    diagnose(work, { operation, endpoint: qorechainTestnetNetwork.url, abi: ABI, ...extra });
  if (await remote("connection", () => client.getChainId()) !== 9800) throw new E2eError("RPC chain ID is not 9800. Stopping.");
  if (command.step === "balances") {
    const buyer = getAddress(derivedAccounts!.buyer.evm);
    const seller = getAddress(derivedAccounts!.seller.evm);
    const [buyerBalance, sellerBalance] = await Promise.all([
      remote("read", () => client.getBalance({ address: buyer })),
      remote("read", () => client.getBalance({ address: seller })),
    ]);
    console.log(`buyer ${buyer}: ${formatEther(buyerBalance)} QOR`);
    console.log(`seller index 1 ${seller}: ${formatEther(sellerBalance)} QOR`);
    return;
  }
  const code = await remote("read", () => client.getCode({ address: REWIND_ADDRESS }));
  if (!code || code === "0x") throw new E2eError("No contract code exists at the configured Rewind deployment.");

  async function agreement(id: bigint, blockNumber?: bigint) {
    return remote("read", () => client.readContract({ address: REWIND_ADDRESS, abi: ABI, functionName: "getAgreement", args: [id], blockNumber }));
  }

  async function digest(id: bigint, action: Action, validUntil: bigint) {
    const current = await agreement(id);
    const value = await remote("read", () => client.readContract({
      address: REWIND_ADDRESS, abi: ABI, functionName: "digestFor", args: [id, actionCode(action), validUntil],
    }));
    if (value !== computeDigest({
      chainId: 9800n, contract: REWIND_ADDRESS, id, action, buyer: current.buyer,
      seller: current.seller, amount: current.amount, termsHash: current.termsHash, validUntil,
    })) throw new E2eError("On-chain digest differs from the expected Rewind V1 payload. Stopping.");
    return value;
  }

  if (command.step === "state") {
    const [current, balance] = await Promise.all([
      agreement(command.id), remote("read", () => client.getBalance({ address: REWIND_ADDRESS })),
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

  const now = (await remote("read", () => client.getBlock())).timestamp;
  if (command.step === "sign") {
    const current = await agreement(command.id);
    if (!signer || getAddress(signer.evm) !== getAddress(current.buyer)) throw new E2eError("The derived buyer does not match the agreement's stored buyer; no signature exported.");
    const validUntil = fulfilByFrom(now, command.validSeconds);
    const message = await digest(command.id, command.action, validUntil);
    const signature = pqcSign(signer.pqc.secretKey, hexToBytes(message));
    const payload = signatureExport(command.id, command.action, validUntil, message, signature);
    const filename = signatureFilename(command.id, command.action);
    try {
      const directory = new URL("../out/", import.meta.url);
      await mkdir(directory, { recursive: true });
      await writeFile(new URL(filename, directory), JSON.stringify(payload, null, 2) + "\n", { mode: 0o600 });
    } catch { throw new E2eError("Could not write the signature export to contracts/out; no transaction was sent."); }
    console.log(`out/${filename}`);
    console.log(`digest: ${message}`);
    console.log(`signature length: ${signature.length} bytes`);
    return;
  }
  if (command.step === "digest") {
    const validUntil = oneHourFrom(now);
    console.log(`validUntil: ${validUntil}`);
    console.log(`digest: ${await digest(command.id, command.action, validUntil)}`);
    return;
  }

  const role = command.step === "fulfil" ? "Seller (index 1)" : "Buyer (index 0)";
  if (!signer) throw new E2eError("A transaction signer is required.");
  const sender = getAddress(signer.evm);
  let data: Hex;
  let value = 0n;
  let id: bigint | undefined;
  let nextState: string;

  if (command.step === "create") {
    const seller = selectedSeller!;
    if (seller === sender) throw new E2eError("SELLER_ADDRESS must differ from the buyer.");
    const fulfilBy = fulfilByFrom(now, command.fulfilInSeconds);
    value = DEMO_AMOUNT;
    data = encodeFunctionData({ abi: ABI, functionName: "createAgreement", args: [seller, DEMO_TERMS_HASH, fulfilBy] });
    nextState = "Funded";
    console.log(`amount (wei): ${value}`);
    console.log(`fulfilBy: ${fulfilBy}`);
    console.log(`fulfilBy UTC: ${utcTime(fulfilBy)}`);
  } else {
    id = command.id;
    const current = await agreement(id);
    console.log(`current state: ${STATE_NAMES[current.state] ?? "Unknown"}`);
    if (command.step === "fulfil") {
      if (sender !== getAddress(current.seller)) throw new DiagnosticError("ADDRESS_MISMATCH", `Derived seller: ${sender}; stored seller: ${getAddress(current.seller)}. No transaction sent.`);
      data = encodeFunctionData({ abi: ABI, functionName: "markFulfilled", args: [id] });
      nextState = "Fulfilled";
    } else {
      if (sender !== getAddress(current.buyer)) throw new DiagnosticError("ADDRESS_MISMATCH", `Derived buyer: ${sender}; stored buyer: ${getAddress(current.buyer)}. No transaction sent.`);
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

  const rest = QORECHAIN_REST_ENDPOINTS[9800];
  const sellerChecks = command.step === "fulfil" ? await Promise.all([
    remote("read", () => readPqcKeyStatus(client, sender)),
    remote("read", () => evmWindowStatus({ rest, address: signer.cosmos }), { endpoint: rest }),
  ]) : undefined;
  if (sellerChecks) {
    const [status, window] = sellerChecks;
    console.log(`seller registered (on-chain pqcKeyStatus): ${status.registered}`);
    console.log(`seller window live: ${window.live}`);
    if (!sellerReadyForSend(status, window)) {
      if (command.send) throw new E2eError(SELLER_SETUP);
      console.warn(SELLER_SETUP);
    }
  }
  const senderBalance = await remote("read", () => client.getBalance({ address: sender }));
  if (senderBalance <= value) {
    const failure = insufficientFunds(sender, senderBalance);
    if (command.send) throw failure;
    // Preserve dry simulation even without gas funds, but make the funding gap explicit.
    console.warn(formatFailure(failure));
  }
  let simulated: Hex | undefined;
  try {
    simulated = (await remote("simulation", () => client.call({ account: sender, to: REWIND_ADDRESS, data, value }), { address: sender, balance: senderBalance })).data;
    console.log("simulation: succeeded");
  } catch (error) {
    console.log("simulation: failed");
    throw error;
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
  const [window, pqc, balance] = await Promise.all([
    sellerChecks ? Promise.resolve(sellerChecks[1]) : remote("read", () => evmWindowStatus({ rest, address: signer.cosmos }), { endpoint: rest }),
    command.step === "fulfil" ? Promise.resolve(undefined) : remote("read", () => fetchPqcStatus({ rest, address: signer.cosmos }), { endpoint: rest }),
    remote("read", () => client.getBalance({ address: sender })),
  ]);
  if (command.step === "fulfil") {
    if (!sellerChecks || !sellerReadyForSend(sellerChecks[0], window)) throw new E2eError(SELLER_SETUP);
  } else {
    if (!pqc?.registered) throw new E2eError(`${role} needs its own registered ML-DSA-87 key. No transaction sent.`);
    if (isRegisteredPqcKey(pqc, signer.pqc.publicKey) !== true) {
      throw new E2eError(`${role} registered key could not be confirmed to match its mnemonic-derived key. No transaction sent.`);
    }
  }
  if (!window.live || window.remainingTxs < 1n || window.remainingBlocks < 1n) {
    throw new E2eError(`${role} needs its own live EVM window with remaining transactions. No transaction sent.`);
  }
  if (window.nativeOnly || (window.allowedTargets.length > 0 && !window.allowedTargets.some((target) => target.toLowerCase() === REWIND_ADDRESS.toLowerCase()))) {
    throw new E2eError(`${role} EVM window does not permit calls to this Rewind contract. No transaction sent.`);
  }
  if (balance <= value) throw insufficientFunds(sender, balance);
  const fees = await remote("read", () => client.estimateFeesPerGas());
  const estimated = await remote("gas estimation", () => client.estimateGas({ account: sender, to: REWIND_ADDRESS, data, value, ...fees }), { address: sender, balance });
  const gas = (estimated * 120n + 99n) / 100n;
  const costWei = value + gas * fees.maxFeePerGas;
  if (balance < costWei) throw insufficientFunds(sender, balance);
  if (window.remainingValue < evmWindowCost({ value, gas, maxFeePerGas: fees.maxFeePerGas })) {
    throw new E2eError(`${role} EVM window has insufficient value-plus-fee allowance. No transaction sent.`);
  }
  console.log(`window transactions remaining before send: ${window.remainingTxs}`);
  console.log(`estimated gas: ${estimated}`);
  const wallet = createWalletClient({
    account: privateKeyToAccount(signer.privateKey as Hex), chain, transport: transport(),
  });
  const hash = await remote("broadcast", () => wallet.sendTransaction({ chain, to: REWIND_ADDRESS, data, value, gas, ...fees }), { address: sender, balance });
  console.log(`transaction hash: ${hash}`);
  const receipt = await remote("receipt", () => client.waitForTransactionReceipt({ hash, timeout: 120_000 }));
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
    console.error(formatFailure(error, { abi: ABI }));
    process.exitCode = 1;
  });
}
