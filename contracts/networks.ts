// Public connection settings shared by Hardhat and read-only tooling.
// Keep this module free of accounts, signing credentials, and environment loading.
export const qorechainTestnetNetwork = {
  chainId: 9800,
  url: "https://evm-testnet.qore.host",
} as const;
