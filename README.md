# Rewind
[![Built on QoreChain](https://build.qorechain.io/badge/rewind.svg)](https://build.qorechain.io/p/rewind)

Rewind is native-QOR escrow on QoreChain testnet with buyer-authorised ML-DSA-87 release and refund.

- A buyer locks payment with a seller, terms hash and fulfilment deadline.
- The seller marks fulfilment; the buyer authorises payment to that stored seller.
- If fulfilment never occurs, the buyer can authorise a refund after the deadline.

## Review in 5 minutes

1. Open the [testnet evidence index](docs/evidence/README.md): transaction records, screenshots and honest limits.
2. From the repository root, run the contract tests with existing dependencies:

   ```sh
   cd contracts
   npm test
   ```

   Expected: **240 passing (240 nodejs)**, from the local run on 22 November 2026.
   Tests use Hardhat's simulated network and load no environment files or deployment credentials.
3. In another terminal, from the repository root:

   ```sh
   cd web
   npm run dev -- --host 127.0.0.1 --mode review
   ```

   Review mode uses public defaults without loading project environment files.
4. Open [agreement 1](http://127.0.0.1:5173/payment/1),
   [agreement 2](http://127.0.0.1:5173/payment/2) and
   [agreement 3](http://127.0.0.1:5173/payment/3). No wallet is needed to read
   stored state and event timelines. The [home page](http://127.0.0.1:5173/)
   and [My payments](http://127.0.0.1:5173/payments) also show public agreements.
   Review read-only; the demonstrated writes were made through the CLI runner.

The app reads the real testnet RPC. Agreement lists enumerate IDs up to a
500-ID cap; timelines filter by agreement ID from the recorded deployment block.
Loading, RPC errors, missing history and state inconsistencies are shown explicitly.

## Live testnet facts

Public identifiers recorded in the [evidence index](docs/evidence/README.md)
and [deployment manifest](contracts/ignition/deployments/chain-9800/deployed_addresses.json):

| Item | Recorded value / explorer |
| --- | --- |
| Network | [QoreChain testnet](https://dashboard.qorechain.io/explorer), native chain `qorechain-diana` |
| EVM chain ID | **9800** |
| Rewind contract | [0x775BbF36986FaBC54b64955c1D9b8EdB388E7c20](https://dashboard.qorechain.io/explorer/address/0x775BbF36986FaBC54b64955c1D9b8EdB388E7c20) |
| Deployer / buyer / window account | [0x42B70a2Be6F875989b18DA907639479802101DB8](https://dashboard.qorechain.io/explorer/address/0x42B70a2Be6F875989b18DA907639479802101DB8); `qor1g2ms52lxlp6e3xccm2g8vw28nqppq8dc5e02fn` |
| Seller | [0xd0e5B9fc404b1036a7C53128B6B756b23e0EFcf0](https://dashboard.qorechain.io/explorer/address/0xd0e5B9fc404b1036a7C53128B6B756b23e0EFcf0); `qor16rjmnlzqfvgrdf79xy5tdd6kkglqal8s3rmk62` |

## How it works

The implemented lifecycle in [Rewind.sol](contracts/contracts/Rewind.sol) is:

```text
createAgreement + deposit -> Funded -- seller, before deadline --> Fulfilled
                              |                                    |
                    buyer, after deadline                  buyer + PQ signature
                      + PQ signature                               |
                              v                                    v
                          Refunded                              Released
                      (stored buyer)                         (stored seller)
```

Creation immediately funds the agreement. Only the stored seller can call
`markFulfilled`, strictly before `fulfilBy`. Only the stored buyer can release
a fulfilled payment or refund a still-funded payment strictly after `fulfilBy`.
`Released` and `Refunded` are terminal; each agreement settles once.

For both settlement actions, the contract loads the **stored buyer's key** via
`pqcKeyStatus` at `0x0A02`, requiring registration, possession proof, algorithm
ID 1 and a 2,592-byte public key. It checks expiry and a 4,627-byte signature,
then requires `pqcVerify` at `0x0A01` to return true for the exact 32-byte digest:

```text
keccak256(abi.encode(
  "REWIND_V1", block.chainid, address(this), id, action,
  buyer, seller, amount, termsHash, validUntil
))
```

`action` is 1 for release and 2 for refund. The digest contains **no nonce**.
Terminal-state checks prevent a second payout. Sign the digest bytes without
an Ethereum message prefix or another hash; see the [signing flow](contracts/scripts/signing-notes/README.md).

The chain's **PQC-authorised EVM window admits the ordinary, classically signed
transaction**. Rewind's separate per-agreement signature authorises settlement
inside the contract. An open window does not replace `pqcVerify`.

## Proven on testnet

The [evidence index](docs/evidence/README.md) records these **sent transactions**;
refund and release also have explorer screenshots. Gas figures are gas used.

| Operation / evidence | Transaction hash | Gas |
| --- | --- | ---: |
| [Create agreement 2](docs/evidence/README.md) | [0xac357fc1a476a424013126711ce8177a89394fccdc9a9849e1dca5c8163f677c](https://dashboard.qorechain.io/explorer/tx/0xac357fc1a476a424013126711ce8177a89394fccdc9a9849e1dca5c8163f677c) | 144327 |
| [Refund agreement 2](docs/evidence/README.md) | [0xff3e29cc829bbd31524d22f3dcb0bd6ecd75a92914d3d8e6ceb1c1a21c67d7fc](https://dashboard.qorechain.io/explorer/tx/0xff3e29cc829bbd31524d22f3dcb0bd6ecd75a92914d3d8e6ceb1c1a21c67d7fc) | 220420 |
| [Create agreement 3](docs/evidence/README.md) | [0x401cfe0a0a7244cef86479e4fc0301b7555f3113b8d4b8c8d519bbb718e08f79](https://dashboard.qorechain.io/explorer/tx/0x401cfe0a0a7244cef86479e4fc0301b7555f3113b8d4b8c8d519bbb718e08f79) | 144315 |
| [Seller fulfils agreement 3](docs/evidence/README.md) | [0xd9b31a36ee00674593e3b5fbf1c0f6577cb0970d0d718115511247c082326ba7](https://dashboard.qorechain.io/explorer/tx/0xd9b31a36ee00674593e3b5fbf1c0f6577cb0970d0d718115511247c082326ba7) | 42280 |
| [Release agreement 3](docs/evidence/README.md) | [0xed0f9c381f362e5799778b2d7eee91079b6143bedd4257e0b30b787be10aa258](https://dashboard.qorechain.io/explorer/tx/0xed0f9c381f362e5799778b2d7eee91079b6143bedd4257e0b30b787be10aa258) | 222894 |

- **Forged-refund rejection check:** the [evidence notes](docs/evidence/README.md#honest-notes)
  describe a live-chain `eth_call` simulation, with no transaction sent.
  The [attack script](contracts/scripts/attack-demo.ts) accepts only
  `InvalidPqcSignature` as signature-rejection success. No transaction hash or
  paid transaction gas exists for that simulation; its referenced screenshot
  is missing, so detailed rejection output is not available in the evidence folder.
- **Scoped window:** opening transaction
  [E06768BE9E60F3969ABEBE74C92FEBAA9E3A070D18BE2214457B160B68BDC48C](docs/evidence/README.md).
  The [status transcript](docs/evidence/terminal-output.md#scoped-window-status-about-7-minutes-after-opening)
  reports a live window with `allowedTargets` containing only Rewind.
  Gas for this native-lane opening is not recorded in the evidence index.
  Gas for this native-lane opening is not recorded in the evidence index.
- **Out-of-scope transfer:** a [broadcast was attempted and refused](docs/evidence/terminal-output.md#out-of-scope-transfer-attempt-attack-demo-transfer-out---send)
  with a window refusal labelled **"exhausted"**. That reply alone does not prove
  scope was the cause. Agreement 3 creation succeeded in the same live window;
  this supports the observation but is not a controlled comparison with an
  unscoped window. REST omitted `validators`, `stakingValidators` and
  `ibcReceivers`, so those scopes are unconfirmed.

## Security and limitations

Payouts go only to the stored buyer or seller. There is no admin withdrawal.
The contract uses a reentrancy guard, sets terminal state before paying, and
reverts state changes if payment fails. See [contract tests](contracts/test/Rewind.ts),
[contract limitations](contracts/README.md#known-limitations) and [audit review](docs/AUDIT.md).

- **No timeout after fulfilment.** The buyer must authorise release; a fulfilled agreement cannot be refunded unilaterally.
- **A seller contract can block release** by reverting when receiving payment.
- **The buyer chooses signature expiry.** The contract enforces it but sets no maximum authorisation lifetime.
- **Seller fulfilment has no contract-level PQ signature.** A compromised seller key, if admitted by its window, could mark fulfilment early and block the timeout refund. Moving funds still requires the buyer's PQ signature.
- **Local mocks are deliberately forgeable, not real cryptography.** They test escrow rules and failure handling; real settlement evidence is separate.
- **Use the web app as a live read-only view with QoreX.** The documented/tested connector path supports connection and reads, without a supported browser ML-DSA signing or QoreX EVM-send path. Demonstrated writes use the CLI runner. Injected-wallet write controls exist, but the browser's signature-paste flow has not been tested end to end on chain.

## QCAI audit

[Stage 1](docs/AUDIT.md): **75/100, MEDIUM, five findings**.
The [report PDF](docs/audit/qcai-audit-stage1.pdf) and
[submitted source](docs/audit/Rewind-combined-for-audit.sol) are retained with
the finding-by-finding review. The audit used the Ethereum setting; quantum
readiness was not scored. **Stage 2 is not done; there is no stage 2 result.**

## What we did not do

- Rewind did not take part in the official Q-Day Drill on 18 November 2026. The classical-key attack demonstration is our own simulation.
- No disputes, arbitration or verification of physical delivery/work quality.
- No Rewind token or token escrow; this contract holds native QOR.
- No mainnet deployment or mainnet transaction flow for this project. Inherited mainnet configuration is not authorisation to use it.

## Setup and commands

Requires **Node.js 22+ and npm**. There is no root package script. For a fresh
checkout, install from the lockfiles with `npm ci` separately in `contracts/`
and `web/`; the five-minute path assumes dependencies are already installed.

| Directory | Commands |
| --- | --- |
| `contracts/` | `npm test`, `npm run typecheck`; `npm run build` for compilation |
| `web/` | `npm run lint`, `npm run typecheck`, `npm test`, `npm run build -- --mode review` |
| `web/`, inspect UI | `npm run dev -- --host 127.0.0.1 --mode review` |

For offline contract tests, `REWIND_SOLC_PATH` can select an existing Solidity
0.8.28 compiler; otherwise Hardhat uses normal compiler discovery. The simulated
test configuration loads no credentials. Deployment and CLI configuration are
separate; see [contracts setup](contracts/README.md) and [web setup](web/README.md).

### Accounts and windows

Manual testnet writes require funded buyer and seller accounts, each with its
own registered ML-DSA-87 key and live EVM window with sufficient block,
transaction and value-plus-fee allowances. The E2E runner uses mnemonic index 0
for the buyer and index 1 for the seller; the seller must match the configured
and stored address. It does not fund accounts, register keys or open windows.

From `contracts/`, check `npm run e2e -- addresses`, then use
`npm run window -- status` and `npm run window -- status --index 1`.
Manual `register` and `open` commands accept the same indices. After deployment,
`npm run window -- open --scope-contract` scopes the buyer's window to Rewind;
add `--index 1` for the seller. Opening replaces the previous window and advances
the account nonce; let it settle before an EVM write. See the
[window setup](contracts/README.md#scope-a-window-to-rewind).

### E2E runner: one step per invocation

Run from `contracts/`, using a fresh agreement for new writes rather than replaying settled examples.

| Command | Effect |
| --- | --- |
| `npm run e2e -- addresses` / `balances` / `state <id>` | Public address report / RPC balances / stored state |
| `npm run e2e -- create --dry` | Simulate creation; `create` without `--dry` sends |
| `npm run e2e -- fulfil <id> --dry` | Simulate seller fulfilment; omit `--dry` to send |
| `npm run e2e -- digest <id> release` | Read the settlement digest; also accepts `refund` |
| `npm run e2e -- sign <id> release` | Export a public signature without sending; also accepts `refund` |
| `npm run e2e -- release <id>` / `refund <id>` | Sign and simulate only |
| `npm run e2e -- release <id> --send` / `refund <id> --send` | Simulate, check prerequisites, then send one settlement transaction |

**Create and fulfil send by default; release and refund require `--send`.**
Creation supports `--fulfil-in <minutes>`; signature export supports
`--valid-minutes <minutes>`. Refund needs a still-funded agreement past its deadline.
Record the mined creation ID and inspect a printed transaction hash before retrying an uncertain outcome.

### Environment variable names

Keep signing configuration in ignored local environment files. Never commit
keys, mnemonics, recovery codes or signature exports; never put signing secrets
in public frontend variables. Variable names only:

| Area | Names |
| --- | --- |
| CLI buyer/seller | `QORE_MNEMONIC`, `SELLER_ADDRESS`, `QORE_NETWORK` |
| Window/deployment fallback | `PRIVATE_KEY`, `QORE_PQC_RECOVERY_CODE` |
| Window allowances / scoped target | `QORE_WINDOW_BLOCKS`, `QORE_WINDOW_TXS`, `QORE_WINDOW_MAX_UQOR`, `REWIND_ADDRESS` |
| Offline test compiler | `REWIND_SOLC_PATH` |
| Public frontend | `VITE_REWIND_ADDRESS`, `VITE_REWIND_DEPLOY_BLOCK`, `VITE_RPC_URL`, `VITE_WALLETCONNECT_PROJECT_ID` |

The E2E signer requires the mnemonic route. The window helper also supports the
private-key/recovery-code fallback; keep the same registered PQC identity.
WalletConnect is not required by the current QoreX/injected connectors.

## AI usage

Built with AI tools, including **VS Code Codex**, with the human developer
directing, reviewing and verifying the work. See [AI_USAGE.md](AI_USAGE.md) for
the prompt log and responsibility statement. Whether illustration assets were
generated with an AI tool: **to be confirmed by the developer**.

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
