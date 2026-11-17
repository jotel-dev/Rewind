# Rewind agent instructions

## Project

Rewind is a post-quantum protected escrow dApp for the QoreChain Developer Fest,
Post-Quantum dApp track, built by a solo developer. The submission deadline is
2 December 2026 at 23:59 UTC.

The planned agreement states are `Created`, `Funded`, `Fulfilled`, `Released`,
`Refunded`, and `Expired`. `Released`, `Refunded`, and `Expired` are terminal
states. The escrow implementation and its transition rules are still to be built.

## Project rules

- Use QoreChain testnet only. Do not deploy or send transactions on mainnet.
- Never commit secrets, private keys, mnemonics, or PQC recovery codes. Use
  ignored `.env` files for local configuration; examples must contain placeholders.
- Never put signing secrets in frontend `VITE_` variables, which are public.
- Keep the contract small and focused on the escrow lifecycle.
- Provide no admin withdrawal or privileged fund recovery mechanism.
- Pay only the buyer and seller stored in the agreement: releases go to the
  stored seller; refunds go to the stored buyer. Do not accept arbitrary payout
  recipients.
- Each agreement may reach exactly one terminal state. Prevent later state
  changes and duplicate payouts, including through reentrancy. Define how any
  escrowed funds are settled before allowing expiry to become terminal.
- Distinguish QoreChain's PQC authorization window from contract-level PQC
  signature verification; do not claim verification that is not implemented.

## Coding rules

- Use npm for package installation and scripts, from `contracts/` or `web/`
  as appropriate; there is no root package script.
- Work in small, focused commits when committing is requested.
- Add a test for every contract function, including relevant authorization,
  state transitions, reverts, and payment behavior. Cover terminal-state
  exclusivity and payout recipients.
- Give brief explanations of changes and report relevant validation results.
- Preserve existing work and avoid unrelated changes or new dependencies.
- Run contract tests on Hardhat's simulated network; use only testnet for
  integration checks and deployments.

## Repository

- `contracts/`: Hardhat 3, Solidity, viem tests, Ignition deployment, and the
  EVM authorization window helper. Run `npm test` from this directory.
- `web/`: Vite, React, TypeScript, wagmi, viem, and RainbowKit frontend.
- The inherited scaffold includes mainnet configuration. Its presence is not
  authorization to use mainnet.
