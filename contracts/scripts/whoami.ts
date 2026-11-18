import { mnemonicToAccount, privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";

// For manual use only: importing Hardhat loads its deployment configuration.
// Resolve that configuration directly, without creating a network connection,
// requesting RPC accounts, or independently selecting environment credentials.
async function main(): Promise<void> {
  const { default: hre } = await import("hardhat");
  const network = hre.config.networks.qorechainTestnet;
  if (network.type !== "http") throw new Error("Unexpected testnet configuration");
  const accounts = network.accounts;
  if (accounts === "remote") throw new Error("A local deployer is required");

  let address: Address;
  if (Array.isArray(accounts)) {
    const first = accounts[0];
    if (first === undefined) throw new Error("No deployer configured");
    const privateKey = await first.getHexString();
    if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) throw new Error("Invalid deployer configuration");
    address = privateKeyToAccount(privateKey as Hex).address;
  } else {
    if (accounts.count < 1) throw new Error("No deployer configured");
    // Match Hardhat's HD derivation: trim the mnemonic and append the initial
    // address index to its configured base path. Preserve its configured passphrase.
    const mnemonic = (await accounts.mnemonic.get()).trim();
    const path = `${accounts.path.replace(/\/$/, "")}/${accounts.initialIndex}`;
    if (!path.startsWith("m/44'/60'/")) throw new Error("Unexpected EVM HD path");
    address = mnemonicToAccount(mnemonic, {
      path: path as `m/44'/60'/${string}`,
      passphrase: await accounts.passphrase.get(),
    }).address;
  }
  process.stdout.write(`${address}\n`);
}

// Never log credential-bearing errors. Success prints one address; failure
// produces no output and exits nonzero.
main().catch(() => { process.exitCode = 1; });
