# Rewind contracts

A [Hardhat 3](https://hardhat.org) project for Rewind's native-asset escrow on
QoreChain testnet. It includes viem tests, an Ignition deployment module, PQC
signing notes, a read-only key-status probe and an EVM authorisation window
helper. The original Counter contract, tests and deployment module are retained.

Use testnet only. The inherited configuration includes mainnet, which is not
authorized for this project.

| Network | EVM chain id | Hardhat network | RPC |
| --- | --- | --- | --- |
| Testnet (`qorechain-diana`) | 9800 | `qorechainTestnet` | `https://evm-testnet.qore.host` |
| Mainnet (`qorechain-vladi`) | 9801 | `qorechain` | `https://evm.qore.host` |

## Prerequisites

- Node.js 22 or later (Hardhat 3 requires it).
- A funded QoreChain testnet account for deployment.

## Setup

```sh
npm install
cp .env.example .env   # the scaffolder already did this
```

Put the deployer's key in `.env` (`PRIVATE_KEY`), or store it encrypted with
`npx hardhat keystore set PRIVATE_KEY`. Never commit `.env`.

## Build and test

```sh
npm run build
npm test
npm run typecheck
```

`npm test` uses `hardhat.test.config.ts` and the simulated network, without
loading environment files or deployment credentials. For restricted or offline
builds, the process variable `REWIND_SOLC_PATH` may point to an existing Solidity
0.8.28 binary or soljson file. Without it, Hardhat uses normal compiler discovery.

## Before you deploy: open an EVM window

QoreChain admits an EVM transaction only when the sender has:

1. a registered **ML-DSA-87** key, and
2. a live **EVM authorisation window**.

Both are set up on QoreChain's native lane with messages signed with the
post-quantum key, so the secp256k1 key in `PRIVATE_KEY` can never authorise
spending on its own. A deploy from an account without them is refused, so do
this first:

```sh
npm run window status     # account, PQC key, window
npm run window register   # once per account: registers its ML-DSA-87 key
npm run window open       # unscoped window: 600 blocks, 5 transactions
```

With `QORE_MNEMONIC` set, the helper derives the account and its ML-DSA-87 key
from the mnemonic. Otherwise it uses `PRIVATE_KEY` for the account and a PQC
recovery code, `QORE_PQC_RECOVERY_CODE`, for the ML-DSA-87 key; it stops with a
message if the code is missing. Create a code once and put it in `.env`:

```sh
npm run window recovery-code   # prints a new secret code; keep the output private
```

Keep a copy of the code apart from the private key and keep using the same
one: a different code gives the account a different ML-DSA-87 key. If the
account already has a key registered by another wallet, open the window from
that wallet instead. An account registered with this helper before SDK 0.13.0
has a different key registered; `npm run window status` then shows
"registered, but NOT this key". Rotate it to the recovery-code key with
`rotatePqcKeyMsg` (MsgRotatePQCKey), loading the old key with
`unifiedAccountFromSeed(seed, { legacySeedDerivation: true })` (see the
`@qorechain/sdk` README).

- The window bounds blocks, EVM transactions, and the total they may spend:
  value **plus** the maximum fee (gas limit x fee cap) of each transaction.
  `npm run window open` sizes it for transactions of up to 3,000,000 gas at a
  250 gwei fee cap; set `QORE_WINDOW_MAX_UQOR` to choose the total yourself.
- `blocks` is a block count, not a duration.
- Opening a window **advances the account's nonce**. Open it first, then
  deploy. Hardhat Ignition waits for 5 confirmations of the account's last
  transaction, so give the window about 10 seconds to settle before
  `npm run deploy:testnet`; otherwise it stops with HHE10402 and you run it again.
- Opening replaces any earlier window.

## Deploy

Run these steps from `contracts/` only when ready to deploy to testnet. Keep
`QORE_NETWORK` on testnet. The deployer must match the account whose PQC key and
window you use; register its key first if needed.

1. Check `npm run window status` and verify the account and PQC key match.
2. Open an **unscoped** window with `npm run window open`. The existing helper
   does not set `nativeOnly` or `allowedTargets`; those restrictions prohibit
   contract creation.
3. Wait about ten seconds for the opening transaction's confirmations. Opening
   advances the deployer's nonce, so sign the deployment only afterwards.
4. Run `npm run deploy:testnet`.

```sh
npm run window status
npm run window open
# Wait about ten seconds before the next command.
npm run deploy:testnet
```

`deploy:testnet` deploys `ignition/modules/Rewind.ts` on `qorechainTestnet`.
Rewind has no constructor arguments. `npm run deploy:counter` retains the old
Counter deployment on the same testnet network; its `initial` parameter can be
changed with an Ignition parameters file.

Contract verification: Sourcify does not list chain ids 9800 and 9801 yet.

## Read-only PQC probe

After local configuration, use either entry point with a public account address:

```sh
npm run probe:pqc -- <evm-or-qor1-address>
```

The underlying command is
`tsx --env-file=.env scripts/probe-pqc.ts <evm-or-qor1-address>`.
The script reads only `QORE_NETWORK` from the process environment and requires
testnet. It gets the public RPC URL and expected chain ID from `networks.ts`,
shared with the Hardhat configuration. It never accesses signing-key, mnemonic
or recovery-code variables. Its command-line loader supplies environment
configuration; the script itself does not read environment files or import the
deployment config.

The probe makes `eth_chainId` and `eth_call` requests. It tries decoding the
key-status response with four outputs, then falls back to three outputs. It
prints the shape, registration flag, algorithm ID, public-key byte length and
possession proof when available; it never prints the key or raw response data.
`qor1` addresses are converted with the installed SDK's `qorToEvm` helper.

An empty result is reported as unavailable, not as an unregistered key. A
three-output result cannot establish possession proof and does not satisfy the
current Rewind contract's four-output interface. Live compatibility still needs
testnet verification. The probe has not been run as part of this change.

## Signing flow

1. Call `digestFor(id, action, validUntil)` on the intended deployment.
2. Sign those exact 32 bytes with the buyer's registered ML-DSA-87 key using
   `pqcSign` from `@qorechain/sdk`.
3. Pass the 4,627-byte signature to `release` or `refund`, using the same
   agreement and expiry and sending from the stored buyer's account.

Use action `1` for release and `2` for refund. Do not prefix or hash the digest
again. See [signing notes](scripts/signing-notes/README.md) for details. No QoreX
signing API is assumed.

## Testnet end-to-end runner

The manual runner targets chain ID **9800** and the supplied Rewind deployment
`0x775BbF36986FaBC54b64955c1D9b8EdB388E7c20`. It checks the RPC chain ID and that
contract code exists before proceeding. It has not been executed against the
network as part of this change.

Run **one step per invocation** from `contracts/`. The underlying command is
`tsx --env-file=.env scripts/e2e.ts <step>`; the npm alias is shown below.
Configure `QORE_MNEMONIC` locally for address, balance and transaction steps.
`SELLER_ADDRESS` is required for create and fulfil; the address report can also
show whether it is unset or invalid. State and digest reads need neither variable.
Only variable names belong in documentation; never commit their values.
`QORE_NETWORK`, if set, must select
testnet. The script itself does not open environment files or import Hardhat's
deployment configuration.

The buyer uses `m/44'/60'/0'/0/0`. The seller uses `m/44'/60'/0'/0/1` from the same
mnemonic. Fulfilment stops if that derived seller differs from `SELLER_ADDRESS`
or from the agreement's stored seller. There is no fallback signer.

| Step | Command | Effect |
| --- | --- | --- |
| Addresses | `npm run e2e -- addresses` | Offline: print the index-0 buyer's 0x/qor1 addresses, the index-1 seller's 0x address, and whether SELLER_ADDRESS is set, valid and matching. No credentials or RPC calls. |
| Balances | `npm run e2e -- balances` | Read the derived buyer and seller balances from the testnet RPC and print them in QOR with their public addresses. No contract call or transaction. |
| Preview creation | `npm run e2e -- create --dry` | Simulate funding without creating an agreement; any printed ID is only predicted. |
| Create | `npm run e2e -- create` | Simulate, check readiness, then send 1,000,000,000,000,000 wei to create an agreement. Record its mined agreement ID. |
| Preview fulfilment | `npm run e2e -- fulfil <id> --dry` | Simulate using the index-1 seller; no transaction is sent. |
| Fulfil | `npm run e2e -- fulfil <id>` | Simulate and then send from the index-1 seller. |
| Digest | `npm run e2e -- digest <id> release` | Read and print the exact on-chain digest and expiry; use `refund` instead for the other action. |
| Preview release | `npm run e2e -- release <id>` | Derive the buyer's PQC key as in `window.ts`, sign the exact digest bytes, and simulate only. |
| Send release | `npm run e2e -- release <id> --send` | Simulate, check readiness, then send one buyer transaction. |
| Preview refund | `npm run e2e -- refund <id>` | Sign and simulate only; requires an unfulfilled agreement past its deadline. |
| Send refund | `npm run e2e -- refund <id> --send` | Simulate, check readiness, then send one buyer transaction. |
| State | `npm run e2e -- state <id>` | Print all stored agreement fields and the contract's native balance in wei. |

**Create and fulfil send by default.** Use `--dry` to prevent broadcasting.
**Release and refund require `--send`.** They also accept explicit `--dry`.
Contradictory, repeated or unknown flags are rejected.
Addresses and balances accept no ID and no `--dry` or `--send` flag.

### Diagnosing a failed step

Local required-variable and seller-selection checks run before RPC access.
Diagnostics use categories and public facts rather than raw provider messages:

| Category | Information shown |
| --- | --- |
| `ENV_MISSING` / `ENV_INVALID` | The variable name only, such as QORE_MNEMONIC or SELLER_ADDRESS; never its value. |
| `ADDRESS_MISMATCH` | Both validated public addresses, including the derived index-1 seller and configured seller. |
| `RPC_UNREACHABLE` | The configured RPC/REST hostname only; no credentials, paths, query strings or request body. |
| `RPC_REJECTED` / `RPC_REQUEST_FAILED` | RPC rejection or read/send failure, its host and an HTTP status when available; provider text is suppressed. |
| `CONTRACT_REVERTED` | A decoded Rewind custom error from a read, for example AgreementNotFound during getAgreement. |
| `SIMULATION_REVERTED` | A decoded Rewind custom error name, such as OnlySeller. Unknown revert strings are suppressed. |
| `INSUFFICIENT_FUNDS` | The sender's public address and balance in QOR and wei, when available. |
| `INPUT` / `UNEXPECTED` | Safe local validation text or a category indicating unavailable structured metadata. |

Revert decoding handles both raw nested RPC data and viem's decoded custom-error
metadata. It never prints custom-error arguments, arbitrary revert strings,
signatures, calldata, request bodies or complete error objects. Unknown failures
remain categorized without guessing a cause.

If a dry run finds no gas funds, it prints a categorized funding warning and
continues the read-only simulation. An actual send stops for insufficient funds.
Use `addresses` to diagnose derivation/configuration offline, then `balances`
when you want to check funding. The balances step always uses the derived index-1
seller, independently of SELLER_ADDRESS.

Creation uses the seller from the environment, terms hash
`keccak256("rewind-demo-order-1")` and a fulfilment deadline one hour after the
latest block timestamp. Digest, release and refund each calculate a fresh
`validUntil` one hour after the latest block timestamp. A digest printed in an
earlier invocation is informational: settlement reads and signs a fresh digest
using the expiry printed in that settlement invocation. No digest or signature
is persisted to disk.

The buyer's ML-DSA-87 key is derived with `deriveUnifiedAccount(mnemonic, 0)` and
the exact 32 digest bytes are signed with `pqcSign`. Output contains only the
signature's byte length and first eight bytes, never the whole signature or a
signing credential. Raw RPC errors and calldata are suppressed; recognized
contract-error names may be shown.

Every transaction step first runs `eth_call`; a failed simulation stops the
step before sending. Before broadcasting, the runner checks the sender's
registration/key match, native balance and live EVM window (including its
remaining transaction, block, target and value-plus-fee allowances), then
estimates gas and fees. It uses a 20% gas headroom and checks the corresponding
maximum cost. Simulations and checks do not reserve that allowance, so chain
state can still change before inclusion.

**The seller needs its own testnet QOR, registered ML-DSA-87 key and live EVM
window.** The buyer's window does not cover index 1. A successful dry simulation
does not prove these transaction-admission requirements. The runner never funds
accounts, registers keys, opens windows or switches signers to work around them.

A successful create/fulfil/release path consumes two buyer EVM transactions and
one seller EVM transaction. Read-only and dry steps do not broadcast. To test
refund, create a separate agreement, leave it unfulfilled and wait until the
chain timestamp is strictly greater than its `fulfilBy`. Fulfilled or released
agreements cannot be refunded.

After broadcasting, the runner immediately prints the hash, then reports gas
used and the state at the receipt's block. It does not automatically retry a
broadcast. If the receipt or broadcast outcome is uncertain, check on-chain
history and any printed hash before repeating a step, especially creation.

## Known limitations

- No timeout after fulfilment: the buyer must authorize release; a fulfilled
  agreement has no unilateral refund path.
- A seller contract can block release by reverting when it receives payment.
- The buyer chooses the signature expiry (`validUntil`); the contract checks it
  but does not impose a maximum authorization lifetime.
- The mock used in tests is deliberately forgeable and is not real cryptography.
- The four-output key-status ABI and real ML-DSA-87 signatures still need
  confirmation on testnet.

## Project layout

```
contracts/Rewind.sol                 native-asset escrow
contracts/interfaces/IQorePQC.sol     precompile interfaces
contracts/test/                      test-only receivers and PQC mock
test/Rewind.ts                       escrow tests (node:test + viem)
test/probe-pqc.ts                    offline probe decoding/address tests
ignition/modules/Rewind.ts           no-argument escrow deployment
scripts/window.ts                    EVM window helper (npm run window)
scripts/probe-pqc.ts                 read-only key-status probe
scripts/e2e.ts                       manual testnet flow (one step per run)
scripts/e2e-utils.ts                 pure CLI, digest, expiry and output helpers
scripts/e2e-errors.ts                categorized diagnostics with sanitized output
test/e2e-utils.ts                    offline tests for the end-to-end helpers
test/e2e-errors.ts                   offline error categorization and safety tests
scripts/signing-notes/README.md       client signing flow (no signing code)
networks.ts                         shared public testnet URL and chain ID
hardhat.config.ts                    deployment compiler/network settings
hardhat.test.config.ts               simulated-only test configuration
contracts/Counter.sol                retained starter contract
test/Counter.ts                      retained starter tests
ignition/modules/Counter.ts           retained starter deployment
```
