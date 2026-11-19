/** A classical-key attack demonstration; simulations never claim to prove transaction admission. */
import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";
import { QORECHAIN_REST_ENDPOINTS, evmWindowCost, qorechainTestnet, toQorAddress } from "@qorechain/evm";
import {
  createPublicClient, createWalletClient, defineChain, encodeFunctionData,
  formatEther, getAddress, http, toHex, type Hex,
} from "viem";
import { mnemonicToAccount, privateKeyToAccount } from "viem/accounts";
import { qorechainTestnetNetwork } from "../networks.js";
import { ABI } from "./e2e.js";
import { E2eError, oneHourFrom, STATE_NAMES } from "./e2e-utils.js";
import { formatFailure, rewindErrorName } from "./e2e-errors.js";
import { loadRewindAddress } from "./rewind-address.js";
import { readWindowStatus, windowScopeLines } from "./window-scope.js";
import { readPqcKeyStatus } from "./probe-pqc.js";
import {
  assessSignatureAttack, assessTransferRejection, assertScopedTransferReady,
  ATTACK_DESCRIPTION, parseAttackArgs, TRANSFER_TARGET, TRANSFER_WEI, type AttackResult,
} from "./attack-demo-utils.js";

function classicalBuyer() {
  // Derive only the classical EVM account: this script never derives or uses a PQC signing secret.
  try {
    const mnemonic = process.env.QORE_MNEMONIC?.trim();
    if (mnemonic) return mnemonicToAccount(mnemonic, { path: "m/44'/60'/0'/0/0" });
    const key = process.env.PRIVATE_KEY?.trim();
    if (key && /^0x[0-9a-fA-F]{64}$/.test(key)) return privateKeyToAccount(key as Hex);
  } catch {
    throw new E2eError("Invalid QORE_MNEMONIC or PRIVATE_KEY; no signing data is printed.");
  }
  throw new E2eError("Set QORE_MNEMONIC for buyer index 0, or PRIVATE_KEY as the classical-only fallback.");
}

export async function main(argv: readonly string[]): Promise<AttackResult> {
  const command = parseAttackArgs(argv);
  if ((process.env.QORE_NETWORK ?? "testnet") !== "testnet") throw new E2eError("This is a testnet-only demonstration (chain ID 9800).");
  console.log(ATTACK_DESCRIPTION);
  if (command.attack === "transfer-out") {
    console.log(`Would transfer ${TRANSFER_WEI} wei (1 uqor) from the buyer to ${TRANSFER_TARGET}.`);
    console.log("Window enforcement happens when the chain admits the transaction, not in a simulation.");
    if (!command.send) {
      console.log("Use --send only after opening a Rewind-only scoped buyer window. If admitted, the tiny amount and gas may be spent.");
      return { pass: true, message: "Dry-run safety: no RPC call or transaction attempted; chain rejection has not been tested." };
    }
  }

  const rewind = await loadRewindAddress(process.env.REWIND_ADDRESS);
  const chain = defineChain({
    id: 9800, name: qorechainTestnet.name, nativeCurrency: qorechainTestnet.nativeCurrency,
    rpcUrls: { default: { http: [qorechainTestnetNetwork.url] } }, testnet: true,
  });
  const transport = () => http(qorechainTestnetNetwork.url, { retryCount: 0 });
  const client = createPublicClient({ chain, transport: transport() });
  if (await client.getChainId() !== 9800) throw new E2eError("RPC chain ID is not 9800; stopping.");
  if (!(await client.getCode({ address: rewind }))?.replace(/^0x$/, "")) throw new E2eError("No Rewind code exists at the selected address.");
  console.log(`Rewind contract: ${rewind}`);

  if (command.attack !== "transfer-out") {
    // eth_call can select the stored buyer as caller without possessing any key.
    const block = await client.getBlock();
    const agreement = await client.readContract({ address: rewind, abi: ABI, functionName: "getAgreement", args: [command.id], blockNumber: block.number });
    const validUntil = oneHourFrom(block.timestamp);
    const signature = command.attack === "release-no-sig" ? "0x" : toHex(randomBytes(4627));
    const functionName = command.attack === "refund-forged" ? "refund" : "release";
    console.log(`agreement ID: ${command.id}; state: ${STATE_NAMES[agreement.state] ?? "Unknown"}`);
    console.log(`simulated caller (stored buyer): ${getAddress(agreement.buyer)}; eth_call needs no signing key`);
    console.log(`invalid signature length: ${(signature.length - 2) / 2} bytes; signature contents are not printed`);
    console.log(`validUntil: ${validUntil}; fulfilBy: ${agreement.fulfilBy}; block timestamp: ${block.timestamp}`);
    try {
      await client.call({
        account: agreement.buyer, to: rewind, blockNumber: block.number,
        data: encodeFunctionData({ abi: ABI, functionName, args: [command.id, validUntil, signature] }),
      });
      return { pass: false, message: "Invalid signature simulation succeeded unexpectedly; no transaction was sent." };
    } catch (error: unknown) {
      const name = rewindErrorName(error, ABI);
      if (!name) throw error;
      console.log(`Rewind error: ${name}`);
      return assessSignatureAttack(command.attack, name, agreement, block.timestamp);
    }
  }

  const account = classicalBuyer();
  const buyer = getAddress(account.address);
  const rest = QORECHAIN_REST_ENDPOINTS[9800];
  const { window, scope } = await readWindowStatus({ rest, address: toQorAddress(buyer) });
  console.log(`buyer: ${buyer}`);
  for (const line of windowScopeLines(scope)) console.log(line);
  assertScopedTransferReady(window, scope, rewind);
  const status = await readPqcKeyStatus(client, buyer);
  if (!status.registered) throw new E2eError("Buyer is not registered; this would test missing registration, not target scoping.");
  const balance = await client.getBalance({ address: buyer });
  console.log(`buyer balance: ${formatEther(balance)} QOR`);
  const fees = await client.estimateFeesPerGas();
  // A read-only gas estimate is a readiness check, never proof of admission rules.
  const gas = await client.estimateGas({ account: buyer, to: TRANSFER_TARGET, value: TRANSFER_WEI, ...fees });
  if (balance < TRANSFER_WEI + gas * fees.maxFeePerGas) throw new E2eError("Buyer lacks native funds for transfer plus maximum gas fees; target scoping cannot be tested.");
  if (window.remainingValue < evmWindowCost({ value: TRANSFER_WEI, gas, maxFeePerGas: fees.maxFeePerGas })) throw new E2eError("Window value-plus-fee allowance is too small; target scoping cannot be tested.");
  const wallet = createWalletClient({ account, chain, transport: transport() });
  let hash: Hex;
  try {
    hash = await wallet.sendTransaction({ to: TRANSFER_TARGET, value: TRANSFER_WEI, gas, ...fees });
  } catch (error: unknown) {
    return assessTransferRejection(error);
  }
  console.log(`transaction hash: ${hash}`);
  // Returning a hash alone is not proof of inclusion; a receipt is required.
  const receipt = await client.waitForTransactionReceipt({ hash, timeout: 120_000 });
  console.log(`gas used: ${receipt.gasUsed}; receipt status: ${receipt.status}`);
  return { pass: false, message: "The transfer was admitted and mined. Target-scope rejection was not demonstrated, even if execution reverted." };
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then((result) => {
    console.log(`${result.pass ? "PASS" : "FAIL"}: ${result.message}`);
    if (!result.pass) process.exitCode = 1;
  }).catch((error: unknown) => {
    console.error(`FAIL: ${formatFailure(error, { abi: ABI, endpoint: qorechainTestnetNetwork.url })}`);
    process.exitCode = 1;
  });
}
