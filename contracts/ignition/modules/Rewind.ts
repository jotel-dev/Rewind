import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// Deploy only on testnet, after opening an unscoped EVM authorization window.
export default buildModule("RewindModule", (m) => {
  const rewind = m.contract("Rewind", []);
  return { rewind };
});
