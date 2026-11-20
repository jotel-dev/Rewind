# Rewind

Rewind is a planned post-quantum protected escrow dApp on QoreChain testnet that
lets a buyer fund an agreement and release payment to its seller after fulfillment.

## Status

**contract and tests in progress**. Built by a solo developer for the QoreChain
Developer Fest, Post-Quantum dApp track. Submission deadline: **2 December 2026,
23:59 UTC**.

The repository contains the Rewind native-asset escrow and a simulated-network
test suite, alongside the inherited `Counter` sample and wallet demo. Rewind
calls QoreChain's PQC precompiles for buyer-authorized release and refund; local
tests use a deliberately forgeable test double, not real ML-DSA-87 verification.
The four-output key-status interface and real signatures still need testnet
validation. The escrow UI is pending. EVM authorization windows remain separate
from the contract's per-agreement PQC authorization.

## Features and remaining work

- Buyer/seller agreements with states `None`, `Funded`, `Fulfilled`, `Released`,
  and `Refunded`. Creation immediately funds an agreement; an unfulfilled
  agreement becomes refundable after its deadline.
- Seller fulfillment, buyer-authorized release/refund, and one terminal state
  per agreement. A fulfilled agreement has no unilateral timeout refund.
- Payments restricted to the stored buyer and seller, with no admin withdrawal.
- Wallet connection and clear PQC key/window readiness information.
- A small escrow contract with tests for every function and payment path.
- Remaining work: escrow UI and testnet validation of real PQC signatures.

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

Prerequisites: Node.js 22 or later, npm, and a funded QoreChain testnet account
for on-chain work. Run installation separately in each project directory; there
is no root package or workspace command. Installation commands below are for
local setup and were not run as part of the initial documentation task.

```sh
cd contracts
npm install
npm run build
npm test
npm run typecheck
```

`npm test` uses `contracts/hardhat.test.config.ts`, which defines only a simulated
network and does not load environment files or deployment credentials.
For an offline or restricted build, the optional process variable
`REWIND_SOLC_PATH` can point to an existing Solidity 0.8.28 binary or soljson file;
otherwise Hardhat uses its normal compiler discovery.

From a separate terminal at the repository root:

```sh
cd web
npm install
npm run dev
```

The frontend runs at `http://localhost:5173`. In `web/`, `npm run build` type-checks
and builds the app; `npm run preview` previews the build.

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
npm run window status
npm run window register
npm run window open
```

`status` reports the account, PQC key match, and window allowances. Registration
is needed once per account. If another wallet already registered the account's
PQC key, use that wallet to open the window. The helper also offers
`npm run window recovery-code`; it prints a new secret, so keep its output private
and do not regenerate a code for an already configured account.

The default window allows 600 blocks and five transactions, with a spending
budget covering value plus maximum fees. Opening replaces the previous window
and advances the account nonce. The starter README advises waiting about ten
seconds for Ignition's confirmation requirement before deploying:

```sh
npm run deploy:testnet
```

The `deploy:testnet` script invokes Hardhat Ignition with
`ignition/modules/Counter.ts` on `qorechainTestnet` and deploys `Counter`, not an
escrow. The Ignition `initial` parameter defaults to zero; pass an Ignition
parameters file with `npm run deploy:testnet -- --parameters <path-to-parameters.json>`
to override it.

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

## Classical-key attack demonstration

The planned script for a classical-key attack demonstration is
`contracts/scripts/attack-demo.ts`.

This demo is our own simulation; Rewind did not take part in the official Q-Day Drill on 18 November 2026.

## Credits

- `create-qorechain-dapp`: the QoreChain Hardhat 3 and viem + wagmi starter kits.
- QoreChain packages: `@qorechain/sdk`, `@qorechain/evm`, and
  `@qorechain/qorex-rainbowkit`.
- Smart contract tooling: `hardhat`, `@nomicfoundation/hardhat-toolbox-viem`,
  `@nomicfoundation/hardhat-viem`, `@nomicfoundation/hardhat-viem-assertions`,
  `@nomicfoundation/hardhat-network-helpers`,
  `@nomicfoundation/hardhat-node-test-runner`,
  `@nomicfoundation/hardhat-keystore`, and `@nomicfoundation/hardhat-verify`.
- Deployment: `@nomicfoundation/hardhat-ignition`,
  `@nomicfoundation/hardhat-ignition-viem`, and `@nomicfoundation/ignition-core`.
- Blockchain clients: `viem` and `@cosmjs/stargate`.
- Frontend: `react`, `react-dom`, `wagmi`, `@rainbow-me/rainbowkit`,
  `@tanstack/react-query`, `vite`, and `@vitejs/plugin-react`.
- Development tooling: `typescript`, `tsx`, `@types/node`, `@types/react`,
  and `@types/react-dom`. Tests also use Node.js's built-in test and assertion modules.
- AI assistance: VS Code Codex, recorded in [AI_USAGE.md](AI_USAGE.md).

## License

The root [LICENSE](LICENSE) is MIT. The inherited `Counter.sol` sample retains
its Apache-2.0 SPDX notice; preserve third-party license notices.
