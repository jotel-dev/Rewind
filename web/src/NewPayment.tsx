import { useState, type FormEvent } from "react";
import { useAccount } from "wagmi";
import { encodeFunctionData, keccak256, parseEther, parseEventLogs, toHex, zeroAddress } from "viem";
import { rewindAbi } from "./abi/rewind.js";
import { CONTRACT } from "./config.js";
import { Icon, Notice, TransactionStatus, useTransaction } from "./components.js";
import { InputError, safeError, sameAddress, validatedParty } from "./lib.js";

function defaultDeadline() {
  const date = new Date(Date.now() + 3600_000);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
export function NewPayment({ navigate }: { navigate: (path: string) => void }) {
  const { address, chainId } = useAccount();
  const [seller, setSeller] = useState(""); const [amount, setAmount] = useState("");
  const [reference, setReference] = useState(""); const [deadline, setDeadline] = useState(defaultDeadline);
  const [error, setError] = useState(""); const tx = useTransaction();
  const [confirmedId, setConfirmedId] = useState<bigint>();
  async function create(event: FormEvent) {
    event.preventDefault(); setError("");
    try {
      const selectedSeller = validatedParty(seller.trim());
      if (selectedSeller === zeroAddress || sameAddress(address, selectedSeller)) throw new InputError("The seller must be a nonzero address different from the buyer.");
      if (!/^\d+(?:\.\d{1,18})?$/.test(amount) || parseEther(amount) <= 0n) throw new InputError("Enter a positive QOR amount with up to 18 decimal places.");
      if (!reference.trim()) throw new InputError("Add an order reference so you can identify the terms.");
      const date = new Date(deadline).getTime();
      if (!Number.isFinite(date) || date <= Date.now()) throw new InputError("Choose a fulfilment deadline in the future.");
      const data = encodeFunctionData({ abi: rewindAbi, functionName: "createAgreement", args: [selectedSeller, keccak256(toHex(reference)), BigInt(Math.floor(date / 1000))] });
      const receipt = await tx.submit(data, parseEther(amount));
      if (receipt) {
        const events = parseEventLogs({ abi: rewindAbi, eventName: "AgreementCreated", logs: receipt.logs.filter((log) => sameAddress(log.address, CONTRACT)) });
        if (events.length !== 1) throw new InputError("Confirmed, but the payment ID could not be identified. Inspect the transaction before repeating this deposit.");
        const id = events[0].args.id; setConfirmedId(id);
        window.setTimeout(() => navigate(`/payment/${id}`), 1600);
      }
    } catch (failure) { setError(safeError(failure)); }
  }
  return <>
    <div className="page-heading"><div><p className="eyebrow">01 / NEW PAYMENT</p><h1>Make the terms.<br />Lock the funds.</h1><p className="lede">A clear agreement. Payment held in escrow.<br className="desktop-break" /> Released with your post-quantum authorisation.</p></div><div className="heading-note"><Icon name="shield" size={28} /><span className="mono">YOUR TERMS.<br />YOUR AUTHORISATION.</span></div></div>
    <div className="create-grid">
      <section className="panel form-panel" aria-labelledby="payment-form-heading">
        <div className="panel-heading"><h2 id="payment-form-heading">Payment details</h2><span className="eyebrow">QOR / TESTNET</span></div>
        <form onSubmit={create}>
          <label htmlFor="seller">Seller address <span className="field-number">01</span></label>
          <input id="seller" autoComplete="off" spellCheck={false} className="mono-input" placeholder="0x…" value={seller} onChange={(event) => setSeller(event.target.value)} required disabled={tx.busy || confirmedId !== undefined} aria-describedby="seller-help" />
          <p className="field-help" id="seller-help">Only this address can mark fulfilment and receive a release.</p>
          <div className="field-row"><div><label htmlFor="amount">Amount <span className="field-number">02</span></label><div className="input-unit"><input id="amount" inputMode="decimal" placeholder="0.00" value={amount} onChange={(event) => setAmount(event.target.value)} required disabled={tx.busy || confirmedId !== undefined} /><span className="mono">QOR</span></div><p className="field-help">Testnet tokens. Network fees are separate.</p></div><div><label htmlFor="deadline">Fulfilment deadline <span className="field-number">03</span></label><input id="deadline" type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} required disabled={tx.busy || confirmedId !== undefined} /><p className="field-help">Shown in your local time.</p></div></div>
          <label htmlFor="reference">Order reference <span className="field-number">04</span></label>
          <input id="reference" placeholder="e.g. Website design — milestone 01" value={reference} onChange={(event) => setReference(event.target.value)} maxLength={500} required disabled={tx.busy || confirmedId !== undefined} aria-describedby="reference-help" />
          <p className="field-help" id="reference-help">We hash this exact text with keccak256 in your browser. The text is not stored on-chain. Keep your own copy.</p>
          <div className="rules"><p className="eyebrow">BEFORE YOU DEPOSIT</p><ul><li>The seller can mark fulfilment before the deadline.</li><li>You release funds with a post-quantum signature.</li><li>You can refund only after the deadline if the seller has not marked fulfilment.</li><li>No admin can move the funds. There is no dispute resolution.</li></ul></div>
          {error && <Notice error>{error}</Notice>}
          {confirmedId !== undefined ? <Notice>Payment #{confirmedId.toString()} is confirmed. <a href={`/payment/${confirmedId}`} onClick={(event) => { event.preventDefault(); navigate(`/payment/${confirmedId}`); }}>Open payment →</a></Notice> : <button className="button primary full-width" type="submit" disabled={!address || chainId !== 9800 || tx.busy}><Icon name="lock" />{tx.busy ? "PROCESSING…" : "LOCK FUNDS"}<Icon /></button>}
          {!address && <p className="button-hint">Connect your wallet to create a payment.</p>}
          <TransactionStatus tx={tx} />
        </form>
      </section>
      <aside className="flow-sidebar"><div className="panel"><p className="eyebrow">A CLEAR PATH FOR YOUR PAYMENT</p><h2>Verify the process.<br />Verify the payment.</h2><ol className="flow-steps"><li><span className="step-index">01</span><div><h3>Lock</h3><p>You deposit QOR. The agreement and its terms hash are recorded on-chain.</p></div></li><li><span className="step-index">02</span><div><h3>Fulfil</h3><p>Your seller marks the agreement fulfilled before the deadline.</p></div></li><li><span className="step-index">03</span><div><h3>Authorise</h3><p>You provide an ML-DSA-87 signature. The contract verifies it before paying the seller.</p></div></li></ol><a href="/security" onClick={(event) => { event.preventDefault(); navigate("/security"); }} className="text-link">Understand the protection <Icon /></a></div><div className="quiet-panel"><Icon name="code" /><div><h3>Small contract. Clear rules.</h3><p>Payments go only to the stored buyer or seller. Read the contract and limitations before funding.</p></div></div></aside>
    </div>
  </>;
}
