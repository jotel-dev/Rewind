import { useState, type FormEvent, type ReactNode } from "react";
import { useAccount } from "wagmi";
import { encodeFunctionData, keccak256, parseEther, parseEventLogs, toHex, zeroAddress } from "viem";
import { rewindAbi } from "./abi/rewind.js";
import { CONTRACT } from "./config.js";
import { Icon, Notice, TransactionStatus, useTransaction } from "./components.js";
import { InputError, safeError, sameAddress, short, validatedParty } from "./lib.js";
import { EscrowVault } from "./PaymentArtwork.js";
import { RecentAgreements, TestnetExamples } from "./RecentAgreements.js";
import "./payments-glass.css";

function checkSeller(seller: string, buyer: string | undefined) {
  const address = validatedParty(seller.trim());
  if (address === zeroAddress || sameAddress(buyer, address)) throw new InputError("The seller must be a nonzero address different from the buyer.");
  return address;
}
function checkAmount(amount: string) {
  if (!/^\d+(?:\.\d{1,18})?$/.test(amount) || parseEther(amount) <= 0n) throw new InputError("Enter a positive QOR amount with up to 18 decimal places.");
}
function checkDeadline(deadline: string) {
  const date = new Date(deadline).getTime();
  if (!Number.isFinite(date) || date <= Date.now()) throw new InputError("Choose a fulfilment deadline in the future.");
  return date;
}
function fieldError(validate: () => unknown) {
  try { validate(); return ""; } catch (error) { return safeError(error); }
}

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
      const selectedSeller = checkSeller(seller, address);
      checkAmount(amount);
      if (!reference.trim()) throw new InputError("Add an order reference so you can identify the terms.");
      const date = checkDeadline(deadline);
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
  const validation = {
    seller: fieldError(() => checkSeller(seller, address)),
    amount: fieldError(() => checkAmount(amount)),
    deadline: fieldError(() => checkDeadline(deadline)),
    reference: reference.trim() ? "" : "Add an order reference so you can identify the terms.",
  };
  const [touched, setTouched] = useState<Partial<Record<keyof typeof validation, boolean>>>({});
  function field(name: keyof typeof validation) {
    const invalid = Boolean(touched[name] && validation[name]);
    return {
      id: name,
      onBlur: () => setTouched((current) => ({ ...current, [name]: true })),
      "aria-invalid": invalid || undefined,
      "aria-describedby": invalid ? `${name}-help ${name}-error` : `${name}-help`,
      required: true,
      disabled: tx.busy || confirmedId !== undefined,
    };
  }
  function feedback(name: keyof typeof validation, help: ReactNode) {
    return <><p className="field-help" id={`${name}-help`}>{help}</p>
      {touched[name] && validation[name] && <p className="payment-field-error" id={`${name}-error`}>{validation[name]}</p>}</>;
  }
  const walletReady = Boolean(address && chainId === 9800);
  const readiness = confirmedId !== undefined || tx.stage === "confirmed" ? "Confirmed on testnet"
    : tx.stage === "pending" ? "Waiting for testnet confirmation"
    : tx.stage === "wallet" ? "Preparing transaction and wallet approval"
    : !address ? "Connect a wallet" : !walletReady ? "Switch to QoreChain testnet"
    : tx.qorex ? "Use a transaction-capable injected wallet" : Object.values(validation).some(Boolean) ? "Complete the payment details"
    : "Ready for simulation and wallet approval";

  return (
    <div className="payment-glass-page">
      <section className="payment-hero" aria-labelledby="create-title">
        <div>
          <p className="eyebrow">01 / NEW PAYMENT</p>
          <h1 id="create-title">Make the terms.<br /><mark>Lock the funds.</mark></h1>
          <p className="payment-lede">A clear agreement. Payment held in escrow.<br />Released with your post-quantum authorisation.</p>
        </div>
        <EscrowVault />
      </section>
      <div className="payment-create-grid">
        <section className="security-glass payment-form-card" aria-labelledby="payment-form-heading">
          <div className="payment-card-heading">
            <div><h2 id="payment-form-heading">Payment details</h2><p>Set the recipient, amount and terms before you deposit.</p></div>
            <span className="payment-chip"><span className="status-dot" /> QOR / TESTNET</span>
          </div>
          <form onSubmit={create}>
            <label htmlFor="seller">Seller address</label>
            <input {...field("seller")} autoComplete="off" spellCheck={false} className="mono-input" placeholder="0x…" value={seller} onChange={(event) => setSeller(event.target.value)} />
            {feedback("seller", "Only this address can mark fulfilment and receive a release.")}
            <div className="field-row">
              <div>
                <label htmlFor="amount">Amount</label>
                <div className="input-unit"><input {...field("amount")} inputMode="decimal" placeholder="0.00" value={amount} onChange={(event) => setAmount(event.target.value)} /><span className="mono">QOR</span></div>
                {feedback("amount", "Testnet tokens. Network fees are separate.")}
              </div>
              <div>
                <label htmlFor="deadline">Fulfilment deadline</label>
                <input {...field("deadline")} type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} />
                {feedback("deadline", "Shown in your local time.")}
              </div>
            </div>
            <label htmlFor="reference">Order reference</label>
            <input {...field("reference")} placeholder="e.g. Website design — milestone 01" value={reference} onChange={(event) => setReference(event.target.value)} maxLength={500} />
            {feedback("reference", "We hash this exact text with keccak256 in your browser. The text is not stored on-chain. Keep your own copy.")}
            <div className="rules">
              <p className="eyebrow">BEFORE YOU DEPOSIT</p>
              <ul>
                <li>The seller can mark fulfilment before the deadline.</li>
                <li>You release funds with a post-quantum signature.</li>
                <li>You can refund only after the deadline if the seller has not marked fulfilment.</li>
                <li>No admin can move the funds. There is no dispute resolution.</li>
              </ul>
            </div>
            {error && <Notice error>{error}</Notice>}
            {confirmedId !== undefined ? (
              <Notice>Payment #{confirmedId.toString()} is confirmed. <a href={`/payment/${confirmedId}`} onClick={(event) => { event.preventDefault(); navigate(`/payment/${confirmedId}`); }}>Open payment →</a></Notice>
            ) : (
              <button className="button primary full-width payment-primary" type="submit" disabled={!walletReady || tx.busy}>
                <Icon name="lock" />{tx.busy ? "PROCESSING…" : "LOCK FUNDS"}<Icon />
              </button>
            )}
            {!walletReady && <p className="button-hint">{address ? "Switch to QoreChain testnet to create a payment." : "Connect your wallet to create a payment."}</p>}
            <TransactionStatus tx={tx} />
          </form>
        </section>
        <aside className="payment-aside">
          <section className="security-glass payment-summary">
            <h2>Payment summary</h2>
            <p className="summary-total">{validation.amount ? "—" : amount} <span>QOR</span></p>
            <dl>
              <div><dt>Network</dt><dd>QoreChain testnet</dd></div>
              <div><dt>Seller</dt><dd>{validation.seller ? "—" : <code title={seller.trim()}>{short(seller.trim())}</code>}</dd></div>
              <div><dt>Network fees</dt><dd>Separate from the deposit</dd></div>
              <div><dt>Readiness</dt><dd>{readiness}</dd></div>
            </dl>
          </section>
          <section className="security-glass payment-process">
            <h2>How escrow works</h2>
            <ol>
              <li><span className="step-index">01</span><div><h3><Icon name="lock" size={15} /> Lock</h3><p>The buyer deposits QOR into the escrow contract.</p></div></li>
              <li><span className="step-index">02</span><div><h3><Icon name="shield" size={15} /> Verify</h3><p>The seller marks fulfilment before the deadline. At settlement, the contract checks the buyer’s signed agreement digest.</p></div></li>
              <li><span className="step-index">03</span><div><h3><Icon size={15} /> Release</h3><p>After fulfilment, the buyer can release funds to the stored seller using a valid ML-DSA-87 signature.</p></div></li>
            </ol>
            <a className="text-link" href="/security" onClick={(event) => { event.preventDefault(); navigate("/security"); }}>Understand the protection <Icon /></a>
          </section>
        </aside>
      </div>
      <TestnetExamples navigate={navigate} />
      <RecentAgreements navigate={navigate} compact />
    </div>
  );
}
