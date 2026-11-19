# Rewind web

A Vite + React + wagmi interface for Rewind's QoreChain testnet escrow. QoreX
and injected wallets remain available through RainbowKit. The browser never
derives signing accounts or accepts a mnemonic, private key or recovery code.

## Run and validate

Use Node.js 22 or later and the existing npm dependencies:

```sh
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
```

Open `http://localhost:5173/`. No deployment is performed by these commands.
The lint script uses TypeScript's unused-symbol checks and a dependency-free
source check for browser signing modules/credentials, raw HTML and image alt
text. Tests cover public signature parsing and validation.

For a review that must not load the project's environment files, use
`npm run dev -- --host 127.0.0.1 --mode review` or
`npm run build -- --mode review`. Review mode selects the empty ignored
`.review/no-env` directory for Vite environment discovery and uses public defaults.

## Public configuration

The example configuration contains these two public settings:

| Variable | Default |
| --- | --- |
| `VITE_REWIND_ADDRESS` | `0x775BbF36986FaBC54b64955c1D9b8EdB388E7c20` |
| `VITE_RPC_URL` | `https://evm-testnet.qore.host` |

Chain ID is fixed at **9800**. Only testnet is configured in wagmi. A wallet on
another chain receives a banner and transaction actions are disabled. The app
checks the RPC chain ID before sending. Never put signing credentials in any
`VITE_` variable: these values are public.

`src/abi/rewind.ts` is copied from the compiled Rewind artifact. After rebuilding
the contract, run `npm run abi` to regenerate it without copying bytecode.

## Screens

| Route | Behaviour |
| --- | --- |
| `/` | Validate seller, amount, order reference and deadline; hash the exact reference in the browser; simulate creation, request wallet approval and confirm the real receipt before opening the payment. |
| `/payment/:id` | Read the stored agreement, countdown and contract-event timeline. Show seller fulfilment or buyer signature-import settlement actions only when the role/state/deadline allow them. |
| `/payment` | Look up an agreement by its positive integer ID. |
| `/payments` | Scan AgreementCreated logs where the connected account is buyer or seller, read current states, and filter by state. |
| `/security` | Explain contract signature protection versus window admission and ordinary EVM signatures; show limitations, source, explorer and evidence links. |

Timelines and My payments scan the most recent **20,000 blocks** in bounded
2,000-block requests. The UI displays the range and warns that older agreements
may be absent. Direct agreement lookup still reads storage for older IDs.
Reads and events use the real RPC; no sample agreements or successful receipts
are fabricated. Without a wallet, My payments displays a connection state.

## Signature handoff

From a local terminal in `contracts/`, run:

```sh
npm run e2e -- sign <id> release
# Or sign a refund:
npm run e2e -- sign <id> refund --valid-minutes 15
```

Default validity is 30 minutes. Import the resulting public JSON from
`contracts/out/` into the authorisation panel. The panel checks the 4,627-byte
signature, matching ID/action, and the on-chain digest for the file's own expiry.
It never stores the signature in localStorage. A raw 0x signature is also
accepted, with an explicitly matching expiry; ID/action metadata cannot be
checked for raw bytes, and cryptographic verification remains on-chain.

Transaction submission simulates first, then uses the connected wallet for the
ordinary EVM signature. A real receipt determines confirmation or failure.
Accounts still need their own registered PQC key and an appropriate live window.
The installed QoreX adapter documents connection/reads but not EVM sending;
the app keeps QoreX and explains when a transaction-capable injected wallet is
needed. No QoreX PQC signing API is assumed.

## Appearance and assets

Light mode is the default; only the theme preference is persisted. Dark mode
uses the white logo, light mode the black logo, and small screens use the mark.
All logos come from `public/brand/`. The actual favicon is
`public/brand/favicon.ico` and the Apple icon is
`public/brand/apple-touch-icon.png`; there is no text-logo fallback.
Inter and JetBrains Mono load from Google Fonts with local font fallbacks.
Layouts support 375px screens, keyboard focus and a skip link.

The inherited native REST proxies remain available in `vite.config.ts`.
For hosting, configure history fallback to `index.html` for client routes and
any required native REST proxy. Nothing has been deployed by this task.
