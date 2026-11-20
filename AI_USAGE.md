# AI usage

Rewind is built with AI tools, including VS Code Codex, to assist with planning,
repository inspection, documentation, implementation, and testing. The solo
developer reviews AI-assisted work and remains responsible for the project.

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
