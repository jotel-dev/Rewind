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
