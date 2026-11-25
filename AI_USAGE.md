# AI usage

Rewind is built with AI tools, including VS Code Codex, to assist with planning,
repository inspection, documentation, implementation, and testing. The solo
developer reviews AI-assisted work and remains responsible for the project.

## Illustration assets

The glass illustrations in `web/src/PaymentArtwork.tsx` and
`web/src/SecurityStack.tsx` are SVG artwork defined in source. The history records
glass artwork and dashboard redesign commits, but does not identify an AI image
tool. The files in `web/public/brand/` have descriptive brand filenames without
generation provenance. Whether any illustration assets in `web/` were generated
with an AI tool: **to be confirmed by the developer**.

## Prompt log

<!-- Add prompts, dates, resulting changes, and review or validation notes here.
     Never include secrets or the contents of private environment files. -->

| Date | Prompt | Summary and output |
| --- | --- | --- |
| 17 November 2026 | Prompt 1 | Inspect the QoreChain scaffolds without changing code, then document Rewind: produced a repository report, root AGENTS.md, AI_USAGE.md and README.md, and missing .gitignore entries. |
| 17 November 2026 | Prompt 2 | Research PQC precompiles and scoped EVM windows, switch root documentation to npm, and record AI usage: produced a source-linked research report, npm commands checked against package scripts, and these prompt-log entries. |
| 17 November 2026 | Prompt 3 | Build native-asset escrow with buyer PQC authorization and security tests without deploying: produced Rewind.sol, precompile interfaces, test doubles, a simulated-only npm test configuration and lifecycle/security tests; updated the project status and recorded validation in chat. |
| 17 November 2026 | Prompt 4 | Prepare Rewind deployment and a read-only PQC ABI probe without network execution: produced the Rewind Ignition module, retained Counter deployment script, shared public testnet settings, probe and offline tests, signing/deployment notes and known limitations. |
| 18 November 2026 | Prompt 5 | Align testnet deployment with the window helper's mnemonic-derived account without copying a private key: added mnemonic-first HD configuration with the existing private-key fallback and an address-only whoami script; preserved environment-free tests and ran tests/typecheck without executing deployment tooling. |
| 18 November 2026 | Prompt 6 | Build a manual one-step testnet escrow runner with dry runs and real SDK PQC signing without network execution by the agent: produced e2e.ts, pure helpers and offline tests, a package script and usage/readiness documentation; ran the local tests and typecheck. |
| 18 November 2026 | Prompt 7 | Diagnose end-to-end failures without exposing signing data and add read-only account reports: added categorized error handling, offline addresses and RPC balances steps, offline safety tests and usage documentation; ran only local tests/typecheck without executing the network runner. |
| 19 November 2026 | Prompt 8 | Add the derived seller's qor1 address to the addresses step using the same SDK address derivation as the buyer: updated public-only address reporting and added an offline regression test; ran local tests and typecheck without accessing environment files or the network. |
| 19 November 2026 | Prompt 9 | Add short configurable creation deadlines and indexed seller window setup: implemented decimal --fulfil-in, UTC deadline output, --index selection and seller-address checks, shared on-chain seller key-status readiness, offline tests and setup documentation; ran local tests/typecheck without network execution. |
| 19 November 2026 | Prompt 10 | Create a judge-facing testnet evidence index from supplied details: added docs/evidence/README.md with account and transaction references, screenshot links and captions, and the stated distinction between contract-level ML-DSA-87 verification and EVM window authorisation; made no network requests. |
| 19 November 2026 | Prompt 11 | Inspect installed window scope APIs and create a classical-key attack demonstration: added Rewind-only scoped windows with explicit REST omission reporting, attack-demo.ts with invalid-signature simulations and an opt-in unrelated-transfer attempt, offline tests and documentation including the official-drill disclaimer; ran local tests/typecheck without executing network scripts or accessing environment files. |
| 19 November 2026 | Prompt 12 | Add a local public-signature export and build the Rewind frontend: implemented the 30-minute sign command and ignored JSON exports, real testnet escrow screens with QoreX/injected wallets, brand assets, theme, signature import checks, event history and security documentation; added offline tests/lint, ran validation and opened desktop/mobile screens read-only against testnet without loading project environment files, sending transactions or deploying. |
| 19 November 2026 | Prompt 13 | Clarify RPC versus wallet status and replace trust wording: changed the RPC label to READING TESTNET, added a separate shortened-address WALLET CONNECTED item only for a connected testnet wallet, and changed the card heading to Verify the process.; lint, typecheck and the review-mode build passed without loading project environment files. |
| 20 November 2026 | Prompt 14 | Update the evidence index with the supplied scoped-window and seller details, agreement 3 transaction records, the missing screenshot filenames, and the four notes on what the evidence supports. |
| 20 November 2026 | Prompt 15 | Compare README Credits with the contracts and web package manifests, list direct dependencies by package name, and retain the QoreChain starter kits and create-qorechain-dapp credit. |
| 20 November 2026 | Prompt 16 | Add the developer's unedited scoped-window and transfer-attempt transcripts and the supplied control note to the evidence, then link the transcripts and available screenshots from the index. |
| 20 November 2026 | Prompt 17 | Document QCAI stage 1, hash the local report, and check its five findings against the submitted and current source, contract tests, and client receipt handling. Record the MVP limitation and leave stage 2 to do. |
| 21 November 2026 | Prompt 18 (full prompt below) | Add the QoreChain badge, public contract qor1 address and offline regression, wallet-free recent agreements, ID lookup, live-state testnet links, Security stack label, and illustration provenance. Run local validation, commit on the feature branch, scan tracked filenames and secret assignments without printing contents, then fast-forward main locally and repeat contract tests and web build. Validation results are recorded below after execution. |
| 21 November 2026 | Prompt 18 continuation | Resume from step 6 after the developer confirmed that the example PRIVATE_KEY value was a scaffold placeholder. Empty only that value, preserve comments and all other example-file bytes, check that code does not load .env.example, and rerun the filename-only safety scan including example files before the requested local commit and fast-forward merge. Do not push. |
| 21 November 2026 | Prompt 19 (full prompt below) | Replace the two agreement-list log scans with shared cached ID enumeration in batches of 10, ending only at ABI-decoded AgreementNotFound or the 500-ID cap. Preserve wallet filters and visual styling, report direct-read coverage, add offline mocked-client and cache tests, and leave the detail timeline's 20,000-block range unchanged. Run frontend checks and simulated contract tests, then commit locally without pushing. |
| 21 November 2026 | Prompt 20 (full prompt below) | Read each agreement's indexed events from deployment block 10320988, verified in the public Ignition receipt; add an unknown-block fallback capped at 600,000 blocks, 20,000-block requests with four concurrent reads and retries, per-ID memory caching, scan coverage and state-inconsistency notes. Document the public setting without reading environment files, add mocked offline tests, run frontend checks and simulated contract tests, and commit locally without pushing. |
| 22 November 2026 | Prompt 21 (full prompt below) | Rewrite the root README for judges using repository source, evidence, audit notes and current simulated test output (240 passing). Preserve the QoreChain badge and existing credits/licence, distinguish sent transactions from simulations and unresolved evidence, retain limitations, document the read-only review path and manual setup, and commit locally without pushing. |
| 24 November 2026 | Prompt 22 (full prompt below) | Add the developer's exact forged-refund eth_call transcript from 20 November 2026, link it from the evidence index, and record the second scoped-window hash without inventing gas figures. Check the optional screenshot locally, validate the transcript and links, and commit without pushing or running network commands. |

### Prompt 18 — 21 November 2026

Context: Rewind, a post-quantum protected escrow dApp. Follow AGENTS.md. Never open or print any .env file or any secret. Do not run git push, git pull or git fetch, do not install packages, and do not send any transaction. The only network traffic allowed is the web app's normal read-only RPC reads while you check the UI. Keep the existing visual style of web/.

PART A: code changes (on the current feature branch)

1. Add this line to the top of README.md, directly under the title: `[![Built on QoreChain](https://build.qorechain.io/badge/rewind.svg)](https://build.qorechain.io/p/rewind)`
2. In contracts/scripts/e2e.ts, make the "addresses" step also print the Rewind contract's qor1 address (derived from the contract's 0x address in ignition/deployments/chain-9800/deployed_addresses.json, key RewindModule#Rewind, with the same conversion helper used for the seller). Public data only. Add or update an offline test.
3. Web UI improvements:
   a. Add a section "Recent agreements on this contract" that works without a wallet, on the My payments page below the wallet-specific list and also on the home page (compact, 5 items). It lists agreements from the contract's AgreementCreated events (real chain reads), newest first, with id, a state badge from getAgreement, amount, short buyer and seller addresses, and a link to /payment/<id>. Use the same event-reading code and block range as the existing My payments page, and handle loading, empty and error states.
   b. Add an "Open payment by ID" input with a button on the My payments page. It navigates to /payment/<id> after validating that the id is a positive integer.
   c. On the home page add a short strip "See it on testnet" with links to /payment/3 and /payment/2, labelled from their real on-chain state (read the state; never hardcode "Released" or "Refunded").
   d. On the Security page change the stack label "Verify / Check agreement" to "Verify / ML-DSA-87 signature checked on-chain". Do not change any other claim.
4. In AI_USAGE.md say whether any illustration assets in web/ were generated with an AI tool, based on what the repo history or file names show. If you cannot tell, write "to be confirmed by the developer".

PART B: checks and commit

5. Append this prompt (21 November 2026) to the Prompt log in AI_USAGE.md. Run npm test and npm run typecheck in contracts/, and lint, typecheck, test and build in web/. If anything fails, fix it, or stop and report; do not continue to the merge.
6. Commit everything on the current branch with the message "feat: Built on QoreChain badge, contract qor1 address, public agreements list". Do not commit anything that git ignores.

PART C: safety check (report file names only, never print file contents)

7. List tracked files matching .env (except .env.example), anything under out/, signature-*.json, files named like keys or mnemonics, and any tracked file containing a non-empty QORE_MNEMONIC=, PRIVATE_KEY= or QORE_PQC_RECOVERY_CODE= assignment. If anything is found, stop and report. Do not merge.

PART D: merge into main (locally only)

8. Show "git branch --show-current", "git status --short" and "git log --oneline main..HEAD".
9. Check that main is an ancestor of the current branch ("git merge-base --is-ancestor main HEAD"). If it is not, stop and report instead of merging.
10. Run "git checkout main" and "git merge --ff-only <the feature branch>". No force options, no rebase. Then run npm test in contracts/ and the web build again on main.
11. Do NOT push. Report the final "git log --oneline -5", the test and build results, and the exact command I should run to push.

Report what changed and anything you could not verify.

### Prompt 18 validation

Before committing, contract tests passed (240 tests) on Hardhat's simulated
network using the cached Solidity compiler, and contract typecheck passed.
Frontend lint, typecheck, tests (11 tests), and
`npm run build -- --mode review` passed. Review mode avoids loading project
environment files. The build reported dependency annotation and bundle-size
warnings. Browser verification was incomplete; the live states of agreements 2
and 3 were not independently confirmed during this task.

The initial safety scan stopped on `contracts/.env.example`. With the developer's
explicit authorization in the continuation, only its PRIVATE_KEY value was
removed, preserving comments and all other bytes. No tracked executable code or
configuration references `.env.example`; the explicit environment-file loaders
use `.env`. The repeated tracked working-tree scan, including both example
files, found no matching filenames or non-empty protected assignments. No
environment-file contents or assignment values were printed. Final local merge
and post-merge validation results are reported in the conversation.

### Prompt 19 — 21 November 2026

Context: Rewind web UI in web/. Follow AGENTS.md. Never open or print any .env file or any secret. Do not run git push, git pull or git fetch, do not install packages and do not send any transaction. Normal read-only RPC reads by the web app are fine. Keep the existing visual style.

Problem: "Recent agreements on this contract" and the "Payment records" list on My payments only scan the most recent 20,000 blocks of event logs, so agreements 1 to 3 (created 19 to 20 November 2026) never appear and the page looks empty.

1. Replace the log scan for these lists with enumeration by ID: read getAgreement(id) for id = 1, 2, 3, ... in batches (for example 10 at a time with viem multicall or parallel reads) until the contract reverts with the custom error AgreementNotFound (decode it from the Rewind ABI), with a hard cap of 500 IDs. Cache the results in memory and handle loading, empty and error states (an RPC failure must not look like "no payments").
2. "Recent agreements on this contract" (My payments and home page) shows the newest agreements first, from this enumeration, with id, state badge, amount, short buyer and seller addresses, and a link to /payment/<id>. It must work without a wallet.
3. "Payment records" for the connected wallet filters the same enumeration by buyer or seller (case-insensitive address match) and keeps the existing state filter chips, counts and search. Replace the footer note about the 20,000-block range with: "Read directly from the Rewind contract: agreements 1 to N." where N is the real last id found.
4. Leave the payment detail page's timeline logic alone, unless it also depends on the same 20,000-block range; if it does, report that instead of changing it.
5. Add offline tests with a mocked client for the enumeration (stops at AgreementNotFound, respects the cap, handles a failing RPC call without reporting an empty list). Run lint, typecheck, tests and build in web/, and npm test in contracts/. Append this prompt (21 November 2026) to the Prompt log in AI_USAGE.md.
6. Commit on the current branch with the message "fix(web): list agreements by ID instead of a 20,000-block log scan". Do not push. Report what changed, which files changed, and anything you could not verify.

### Prompt 19 validation

Frontend lint, typecheck, all 17 offline tests, and
`npm run build -- --mode review` passed. Review mode avoided loading project
environment files; the build reported dependency annotation and bundle-size
warnings. All 240 contract tests passed on Hardhat's simulated network with the
cached compiler and telemetry disabled. No packages were installed and no
transactions or remote Git operations were performed.

The detail timeline still uses `recentEvents(id)` with the most recent 20,000
blocks and was left unchanged. The lists now read agreements directly, share an
in-memory cache, and report their actual ID coverage and any 500-ID cap. Live
testnet data and browser rendering were not verified in this run.

### Prompt 20 — 21 November 2026

Context: Rewind web UI in web/. Follow AGENTS.md. Never open or print any .env file or any secret. Do not run git push, git pull or git fetch, do not install packages and do not send any transaction. Normal read-only RPC reads by the web app are fine. Keep the existing visual style.

Problem: the payment detail timeline (/payment/<id>) reads events from only the most recent 20,000 blocks, so agreements created earlier (ids 1 to 3, created 19 to 20 November 2026) show an empty timeline.

1. Change the timeline to read the events for that single agreement id (AgreementCreated, AgreementFulfilled, AgreementReleased, AgreementRefunded all have an indexed id) by scanning from the contract's deployment block to the latest block instead of the last 20,000 blocks. Add a config value VITE_REWIND_DEPLOY_BLOCK (document it in web/.env.example), with the default <DEPLOY_BLOCK>. If the default is "unknown", scan backwards from the latest block in chunks of 20,000 blocks, filtered by id, until AgreementCreated for that id is found or 600,000 blocks have been scanned, and say in the UI when the scan limit was reached.
2. Use chunked getLogs requests (20,000 blocks each, 3 to 5 in parallel) with retry on failure, a visible loading state, and an error state that never looks like an empty timeline. Cache the result per id in memory. Order events by block number then log index and link each to https://dashboard.qorechain.io/explorer/tx/{hash}.
3. The timeline must agree with the on-chain state from getAgreement; if the final event in the timeline does not match the current state, show a clear inconsistency note instead of hiding it.
4. Add offline tests with a mocked client (chunking, ordering, retry, missing events, scan limit). Run lint, typecheck, tests and build in web/, and npm test in contracts/. Append this prompt (21 November 2026) to the Prompt log in AI_USAGE.md.
5. Commit on the current branch with the message "fix(web): read the agreement timeline from the deployment block". Do not push. Report what changed and anything you could not verify.

### Prompt 20 validation

Frontend lint, typecheck, all 26 offline tests, and
`npm run build -- --mode review` passed. Review mode avoided loading environment
files. The build reported dependency annotation and bundle-size warnings. All
240 contract tests passed on Hardhat's simulated network, using the cached
compiler with telemetry disabled.

The default deployment block was checked against the public Ignition receipt,
not a live RPC. The environment example was documented by appending only the
public setting and explanatory comments, without reading or printing its
contents. Offline tests cover ID filters, chunk coverage and concurrency,
ordering and deduplication, retries and exhausted failures, backward discovery,
scan limits, missing events, state inconsistencies, and per-ID memory caching.
Live testnet histories and browser rendering were not verified in this run.
No packages were installed, transactions sent, or remote Git operations run.

### Prompt 21 — 22 November 2026

Context: Rewind. Follow AGENTS.md. Never open or print any .env file or any secret. Do not run git push, git pull or git fetch, do not install packages, and do not send any transaction. Do not run network commands.

Rewrite the top-level README.md for judges. Use only facts that exist in this repo (contracts, tests, docs/evidence, docs/AUDIT.md, docs/audit, scripts, web). Keep the "Built on QoreChain" badge directly under the title. Structure:

1. One-sentence pitch and a 3-line "what it does".
2. "Review in 5 minutes": the shortest path for a judge: open docs/evidence/README.md, run npm test in contracts/ (say the expected number of passing tests, read from the current test output), open the web app read-only (the exact commands), and look at agreements 1 to 3 on testnet.
3. Live testnet facts table: network, chain id, contract address, deployer/buyer and seller accounts (public addresses), with links to the explorer.
4. "How it works": the state machine (Funded, Fulfilled, Released, Refunded), who can do what, and the release/refund authorisation (pqcKeyStatus key, pqcVerify, the digest fields from Rewind.sol, not a nonce). A simple text diagram.
5. "Proven on testnet" with transaction hashes and gas for create, fulfil, release, refund, the forged-refund rejection and the scoped window, each linking to docs/evidence. Say precisely what is simulated versus sent, and keep the honest notes (the out-of-scope transfer was refused with a window refusal labelled "exhausted" and that alone does not prove the scope was the cause).
6. Security and limitations: copy the known limitations from the contract README and docs/AUDIT.md (no timeout after fulfilment, seller contract can block release, buyer chooses signature expiry, seller's markFulfilled is not PQ-signed, mocks in tests are not real cryptography, QoreX in the tested build cannot sign ML-DSA or send EVM transactions from the browser so writes go through the CLI runner, the web app is a live read-only view).
7. QCAI audit: stage 1 result (75/100, MEDIUM, five findings) linking docs/AUDIT.md; state that stage 2 is not done and do not claim a stage 2 result.
8. "What we did not do": the official Q-Day Drill (registration closed; the attack demonstration is our own simulation), disputes, tokens, mainnet.
9. Setup and commands for contracts and web, the e2e runner steps, environment variable NAMES only (never values), and the account/window prerequisites.
10. AI usage: link AI_USAGE.md and say the project is built with AI tools (VS Code Codex) with the human directing and verifying; mention whether illustration assets were AI-generated exactly as AI_USAGE.md says.
11. Credits (keep the existing list) and licence (MIT).

Do not state anything you cannot verify from the repo; if unsure, leave it out and list it in your report. Keep it clear and scannable, not longer than needed. Append this prompt (22 November 2026) to the Prompt log in AI_USAGE.md. Commit on the current branch with the message "docs: rewrite README for judges". Do not push. Report what changed and what you could not verify.

### Prompt 21 validation

The current local `npm test` run in `contracts/` reported **240 passing
(240 nodejs)** on Hardhat's simulated network, using the existing cached compiler
with telemetry disabled. No environment files were opened, packages installed,
network commands run or transactions sent. The web server and CLI network steps
were documented but not executed. Existing credits and licence text were
preserved exactly; local documentation links and copied transaction/gas records
were checked against repository evidence.

The repository does not establish that official Q-Day Drill registration was
closed, so that reason was omitted. The forged-refund screenshot and detailed
rejection output are missing from the evidence folder, and scoped-window gas
is not recorded. Browser signature-paste support remains unverified on chain;
the documented QoreX read-only path is distinguished from injected-wallet write
controls present in source. Current RPC state and explorer pages were not
independently checked because this task prohibited network commands.

### Prompt 22 — 24 November 2026

Context: Rewind. Follow AGENTS.md. Never open or print any .env file. Do not run any network command, git push, pull or fetch.

Edit docs/evidence/terminal-output.md. Add a new section "Forged refund (attack-demo refund-forged 1)" with the exact output below, unedited, in a fenced text block, with one line saying it is copied from the developer's terminal on 20 November 2026 and that it is an eth_call simulation, no transaction was sent:

```text
a classical-key attack demonstration
Rewind contract: 0x775BbF36986FaBC54b64955c1D9b8EdB388E7c20
agreement ID: 1; state: Funded
simulated caller (stored buyer): 0x42B70a2Be6F875989b18DA907639479802101DB8; eth_call needs no signing key
invalid signature length: 4627 bytes; signature contents are not printed
validUntil: 1795160483; fulfilBy: 1795048996; block timestamp: 1795156883
Rewind error: InvalidPqcSignature
PASS: InvalidPqcSignature: Rewind rejected the invalid signature in eth_call; no transaction was sent.
```

Then, in docs/evidence/README.md, link this section, and add to the transaction table: "Second scoped window, opened before sign and release of agreement 3: 5D35C25B9F716A71292DAB88FF7A7799C0F4481AE44231831AB8F6E2CDBB9035". Check that attack-forged-refund.png exists in docs/evidence; link it only if it does, and otherwise list it as missing in your report. Do not invent gas figures for the window transactions. Append this prompt (24 November 2026) to AI_USAGE.md. Commit with the message "docs: add forged-refund transcript and second window hash". Do not push. Report what changed.

Validation: the eight transcript lines were checked against the supplied text;
the evidence link points to the matching section heading. The second window
hash was copied exactly with no gas figure added. The screenshot
`docs/evidence/attack-forged-refund.png` is missing and was not linked. No
environment files were opened and no network commands or transactions were run.
