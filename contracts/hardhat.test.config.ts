import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { defineConfig } from "hardhat/config";

// Optional existing compiler binary/soljson path for offline or restricted runs.
// This reads a process variable only; no environment file is loaded.
const compiler = { version: "0.8.28", path: process.env.REWIND_SOLC_PATH };

// Keep npm test isolated from deployment accounts and all environment files.
export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],
  solidity: {
    profiles: {
      default: compiler,
      production: {
        ...compiler,
        settings: { optimizer: { enabled: true, runs: 200 } },
      },
    },
  },
  networks: {
    hardhatMainnet: { type: "edr-simulated", chainType: "l1" },
  },
});
