# Rewind

Rewind is a planned post-quantum protected escrow dApp on QoreChain testnet that
lets a buyer fund an agreement and release payment to its seller after fulfillment.

## Status

Early scaffold and planning stage, built by a solo developer for the QoreChain
Developer Fest, Post-Quantum dApp track. Submission deadline: **2 December 2026,
23:59 UTC**.

The repository currently contains a sample `Counter` contract and a wallet demo.
Escrow contracts, escrow UI, and escrow-specific PQC verification are not yet
implemented. The scaffold includes helpers for QoreChain's ML-DSA-87 key
registration and EVM authorization windows; these are distinct from verifying
PQC signatures inside an escrow contract.

## Planned features

- Buyer/seller agreements with states `Created`, `Funded`, `Fulfilled`,
  `Released`, `Refunded`, and `Expired`.
- Funding, fulfillment confirmation, payment release, refunds, and expiry with
  explicit transition rules and one terminal state per agreement.
- Payments restricted to the stored buyer and seller, with no admin withdrawal.
- Wallet connection and clear PQC key/window readiness information.
- A small escrow contract with tests for every function and payment path.

## Tech stack and layout

- `contracts/`: Solidity (configured compiler 0.8.28), Hardhat 3, viem,
  `node:test`, and Hardhat Ignition. Sources are in `contracts/contracts/`, tests
  in `contracts/test/`, deployments in `contracts/ignition/modules/`, and the
  authorization helper in `contracts/scripts/window.ts`.
- `web/`: React 18, TypeScript, Vite 5, wagmi 2, viem 2, RainbowKit 2, and
  TanStack Query 5. Application code is in `web/src/`; wallet configuration is
  in `web/src/wagmi.ts`.
- QoreChain SDK/EVM packages provide native signing, chain definitions, and
  authorization window utilities; the QoreX adapter supplies wallet integration.

Use **testnet only**: EVM chain ID **9800**, RPC
`https://evm-testnet.qore.host`, native chain ID `qorechain-diana`.
The inherited scaffold also includes mainnet configuration; do not use it for Rewind.

## Setup

Prerequisites: Node.js 22 or later, pnpm, and a funded QoreChain testnet account
for on-chain work. Run installation separately in each project directory; there
is no root package or workspace command. Installation commands below are for
local setup and were not run as part of the initial documentation task.

```sh
cd contracts
pnpm install
pnpm build
pnpm test
pnpm typecheck
```

From a separate terminal at the repository root:

```sh
cd web
pnpm install
pnpm dev
```

The frontend runs at `http://localhost:5173`. In `web/`, `pnpm build` type-checks
and builds the app; `pnpm preview` previews the build.

### Local configuration

Use ignored `.env` files inside the relevant project directory. The scaffold
provides `.env.example` files; copy an example only if the corresponding `.env`
does not already exist. Never commit or share secret values.

| Variable | Use |
| --- | --- |
| `PRIVATE_KEY` | EVM deployer key; also used by the window helper when no mnemonic is supplied. Hardhat also supports its encrypted keystore. |
| `QORE_MNEMONIC` | Alternative account/key source for the window helper. Its derived account must match the EVM deployer. |
| `QORE_PQC_RECOVERY_CODE` | Required by the helper when using the private-key route; retain the same code and back it up separately from the private key. |
| `QORE_NETWORK` | Optional native network selector; keep the helper on testnet. |
| `QORE_WINDOW_BLOCKS` | Optional window block allowance. |
| `QORE_WINDOW_TXS` | Optional window transaction allowance. |
| `QORE_WINDOW_MAX_UQOR` | Optional total window budget for value plus maximum transaction fees. |
| `VITE_WALLETCONNECT_PROJECT_ID` | Optional frontend setting if WalletConnect wallets are added; current connectors do not require it. |

Never place private keys, mnemonics, or recovery codes in frontend `VITE_`
variables: these are exposed to the browser.

### Testnet deployment of the existing sample

From `contracts/`, after configuring the deployer and its matching PQC credentials:

```sh
pnpm window status
pnpm window register
pnpm window open
```

`status` reports the account, PQC key match, and window allowances. Registration
is needed once per account. If another wallet already registered the account's
PQC key, use that wallet to open the window. The helper also offers
`pnpm window recovery-code`; it prints a new secret, so keep its output private
and do not regenerate a code for an already configured account.

The default window allows 600 blocks and five transactions, with a spending
budget covering value plus maximum fees. Opening replaces the previous window
and advances the account nonce. The starter README advises waiting about ten
seconds for Ignition's confirmation requirement before deploying:

```sh
pnpm deploy:testnet
```

This runs `hardhat ignition deploy ignition/modules/Counter.ts --network
qorechainTestnet` and deploys `Counter`, not an escrow. The Ignition `initial`
parameter defaults to zero and can be overridden with `--parameters`.

### Frontend wallets and hosting

The starter offers QoreX and injected browser wallets through RainbowKit.
Its README describes QoreX as supporting connection and reads; use a signing
injected wallet for transactions. Sending also requires that account's PQC key
registration and live EVM authorization window.

Vite's development and preview servers proxy `/lcd-testnet` to the native REST
API at `https://api-testnet.qore.host`. A production host needs an equivalent
proxy for the window panel. No frontend hosting deployment command is included.

See [contracts setup](contracts/README.md), [frontend setup](web/README.md),
[agent rules](AGENTS.md), and [AI usage](AI_USAGE.md) for details.

## Credits

- `create-qorechain-dapp`: the QoreChain Hardhat 3 and viem + wagmi starter kits.
- QoreChain packages: `@qorechain/sdk`, `@qorechain/evm`, and
  `@qorechain/qorex-rainbowkit`.
- Smart contract tooling: Hardhat, its viem toolbox and plugins, Hardhat
  Ignition, viem, and CosmJS (`@cosmjs/stargate`).
- Frontend libraries: React, React DOM, wagmi, RainbowKit, TanStack Query, Vite,
  and the Vite React plugin.
- Development tooling: TypeScript, tsx, and Node.js testing/assertion modules.
- AI assistance: VS Code Codex, recorded in [AI_USAGE.md](AI_USAGE.md).

## License

The root [LICENSE](LICENSE) is MIT. The inherited `Counter.sol` sample retains
its Apache-2.0 SPDX notice; preserve third-party license notices.
