import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { configVariable, defineConfig } from "hardhat/config";
import { qorechainTestnetNetwork } from "./networks.js";

// Load .env (QORE_MNEMONIC or PRIVATE_KEY) when present. Both credentials use
// the same loader; configVariable resolves the selected credential lazily.
try {
  process.loadEnvFile();
} catch {
  // No .env: rely on the environment or the keystore.
}

// Match window.ts: a nonblank mnemonic takes precedence over PRIVATE_KEY.
// Hardhat appends initialIndex to this path, producing m/44'/60'/0'/0/0.
const useMnemonic = Boolean(process.env.QORE_MNEMONIC?.trim());

// Public QoreChain EVM endpoints.
export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],
  solidity: {
    profiles: {
      default: { version: "0.8.28" },
      production: {
        version: "0.8.28",
        settings: { optimizer: { enabled: true, runs: 200 } },
      },
    },
  },
  networks: {
    hardhatMainnet: { type: "edr-simulated", chainType: "l1" },
    qorechainTestnet: {
      type: "http",
      chainType: "l1",
      ...qorechainTestnetNetwork,
      accounts: useMnemonic
        ? {
            mnemonic: configVariable("QORE_MNEMONIC"),
            path: "m/44'/60'/0'/0",
            initialIndex: 0,
            count: 1,
            passphrase: "",
          }
        : [configVariable("PRIVATE_KEY")],
    },
    qorechain: {
      type: "http",
      chainType: "l1",
      chainId: 9801,
      url: "https://evm.qore.host",
      accounts: [configVariable("PRIVATE_KEY")],
    },
  },
});
