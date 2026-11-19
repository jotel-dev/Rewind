import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { encodeFunctionData } from "viem";
import { rewindAbi } from "./abi/rewind.js";
import { CONTRACT, publicClient, transactionUrl, addressUrl } from "./config.js";
import { recentEvents, useAgreement, useHead, RECENT_BLOCKS } from "./chain.js";
import { Badge, ChainText, Empty, Icon, Notice, TransactionStatus, useTransaction } from "./components.js";
import { parseSignature, paymentId, qor, safeError, sameAddress, short, utc, type ImportedSignature, type SettlementAction } from "./lib.js";

function Countdown({ deadline }: { deadline: bigint }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const seconds = Math.floor(Number(deadline) - now / 1000);
  if (seconds <= 0) return <span>Deadline passed</span>;
  const days = Math.floor(seconds / 86400); const hours = Math.floor(seconds % 86400 / 3600); const minutes = Math.floor(seconds % 3600 / 60);
  return <span>{days ? `${days}d ` : ""}{hours}h {minutes}m {seconds % 60}s remaining</span>;
}

function SignaturePanel({ id, action, now, afterSend }: { id: bigint; action: SettlementAction; now: bigint; afterSend: () => void }) {
  const [validUntil, setValidUntil] = useState(() => (now + 1800n).toString());
  const [acceptedText, setAcceptedText] = useState(""); const [imported, setImported] = useState<ImportedSignature>();
  const [error, setError] = useState(""); const tx = useTransaction();
  const expiry = /^[0-9]{1,78}$/.test(validUntil) && BigInt(validUntil) > 0n && BigInt(validUntil) < 1n << 256n ? BigInt(validUntil) : undefined;
  const digest = useQuery({ queryKey: ["digest", CONTRACT, id.toString(), action, validUntil], queryFn: () => publicClient.readContract({ address: CONTRACT, abi: rewindAbi, functionName: "digestFor", args: [id, action === "release" ? 1 : 2, expiry!] }), enabled: expiry !== undefined, retry: 1 });
  function accept(text: string) {
    if (!text.trim()) { setAcceptedText(""); setImported(undefined); setError(""); return; }
    try {
      const result = parseSignature(text, id, action);
      setImported(result); setAcceptedText(text.trim()); setError("");
      if (result.validUntil !== undefined) setValidUntil(result.validUntil.toString());
    } catch (failure) { setImported(undefined); setAcceptedText(""); setError(safeError(failure)); }
  }
  const match = Boolean(imported && digest.data && (!imported.digest || imported.digest.toLowerCase() === digest.data.toLowerCase()));
  const expired = expiry === undefined || expiry < now;
  async function settle() {
    if (!imported || !match || expired || expiry === undefined) return;
    const receipt = await tx.submit(encodeFunctionData({ abi: rewindAbi, functionName: action, args: [id, expiry, imported.signature] }));
    if (receipt) { setImported(undefined); setAcceptedText(""); afterSend(); }
  }
  return <section className="panel signature-panel"><div className="panel-heading"><h2>Authorise {action}</h2><span className="eyebrow">ML-DSA-87</span></div>
    <p>Produce the authorisation in your local terminal, then import its public signature. This page never asks for a signing key or recovery phrase.</p>
    <p className="eyebrow">01 / RUN FROM THE CONTRACTS FOLDER</p><pre className="command">npm run e2e -- sign {id.toString()} {action}</pre><p className="field-help">Default validity: 30 minutes. Optional: <code>--valid-minutes 15</code>. No transaction is sent.</p>
    <label htmlFor="valid-until">Signature expiry · Unix seconds</label><input id="valid-until" inputMode="numeric" className="mono-input" value={validUntil} onChange={(event) => { setValidUntil(event.target.value); if (imported?.digest) { setImported(undefined); setAcceptedText(""); } }} disabled={tx.busy} />
    {expiry !== undefined && expiry <= 8_640_000_000_000n && <p className="field-help">{utc(expiry)}</p>}
    <p className="eyebrow digest-label">EXACT ON-CHAIN DIGEST</p><ChainText>{digest.isPending ? "Reading digestFor…" : digest.data ?? "Digest unavailable"}</ChainText>{digest.error && <Notice error>{safeError(digest.error)}</Notice>}
    <label htmlFor="signature-json">02 / Paste signature JSON or complete 0x signature</label><textarea id="signature-json" rows={5} className="mono-input" value={acceptedText} placeholder={'Paste out/signature-' + id + '-' + action + '.json here.\nNo keys. No phrases.'} onPaste={(event) => { event.preventDefault(); accept(event.clipboardData.getData("text")); }} onChange={(event) => accept(event.target.value)} disabled={tx.busy} autoComplete="off" spellCheck={false} />
    <p className="field-help">JSON imports supply the exact signed expiry and must match this ID, action and on-chain digest. Raw signatures require you to set their exact expiry above; their ID/action metadata cannot be checked locally.</p>
    {error && <Notice error>{error}</Notice>}
    {imported && <div className="verification-list"><p><Icon name="check" />4,627-byte signature</p><p><Icon name="check" />{imported.id ? "ID and action match" : "Raw signature: no ID/action metadata"}</p><p><Icon name={match && imported.digest ? "check" : "clock"} />{digest.isFetching ? "Checking digest…" : imported.digest ? match ? "Digest matches digestFor" : "Digest mismatch — cannot send" : "Digest shown; raw signature verification happens on-chain"}</p></div>}
    {expired && <Notice error>Choose a valid expiry in the future or generate a new signature file.</Notice>}
    <button type="button" className="button primary full-width" disabled={!match || expired || digest.isFetching || tx.busy} onClick={() => void settle()}><Icon name="shield" />{tx.busy ? "PROCESSING…" : `AUTHORISE ${action.toUpperCase()}`}<Icon /></button><TransactionStatus tx={tx} />
  </section>;
}

export function Payment({ rawId }: { rawId: string }) {
  const id = paymentId(rawId); const agreement = useAgreement(id); const head = useHead();
  const { address, chainId } = useAccount(); const tx = useTransaction(); const cache = useQueryClient();
  const timeline = useQuery({ queryKey: ["timeline", CONTRACT, id?.toString()], queryFn: () => recentEvents(id), enabled: id !== undefined, retry: 1, refetchInterval: 30000 });
  const [lookup, setLookup] = useState("");
  function refresh() { void cache.invalidateQueries({ queryKey: ["agreement"] }); void cache.invalidateQueries({ queryKey: ["timeline"] }); }
  if (!id) return <><div className="page-heading"><div><p className="eyebrow">PAYMENT LOOKUP</p><h1>Find your payment.</h1><p className="lede">Enter an on-chain agreement ID to view its status.</p></div></div><form className="panel lookup-form" action={`/payment/${lookup}`}><label htmlFor="lookup-id">Agreement ID</label><input id="lookup-id" inputMode="numeric" pattern="[0-9]+" required value={lookup} onChange={(event) => setLookup(event.target.value)} placeholder="e.g. 2" /><button className="button primary" type="submit"><Icon name="arrow" />OPEN PAYMENT</button></form></>;
  const current = agreement.data;
  const buyer = current && sameAddress(address, current.buyer); const seller = current && sameAddress(address, current.seller);
  const now = head.data?.timestamp; const canSend = chainId === 9800;
  const action: SettlementAction | undefined = current && buyer && canSend && now !== undefined ? current.state === 2 ? "release" : current.state === 1 && now > current.fulfilBy ? "refund" : undefined : undefined;
  const labels: Record<string, string> = { AgreementCreated: "Payment created & funded", AgreementFulfilled: "Seller marked fulfilment", AgreementReleased: "Funds released to seller", AgreementRefunded: "Funds refunded to buyer" };
  return <><div className="page-heading compact"><div><p className="eyebrow">ON-CHAIN AGREEMENT / {id.toString().padStart(4, "0")}</p><h1>Payment #{id.toString()}</h1><p className="lede">The agreement, exactly as recorded on testnet.</p></div>{current && <Badge state={current.state} />}</div>
    {agreement.isPending && <Notice>Reading getAgreement from QoreChain testnet…</Notice>}
    {agreement.error && <Notice error>{safeError(agreement.error)} <button className="inline-button" onClick={() => void agreement.refetch()}>Retry</button></Notice>}
    {current && <><div className="payment-grid"><section className="panel agreement-details"><div className="panel-heading"><h2>Agreement details</h2><span className="eyebrow">CHAIN 9800</span></div><div className="amount-display"><span className="eyebrow">ESCROW AMOUNT</span><p>{qor(current.amount)} <span>QOR</span></p><span className="field-help">{current.state === 3 || current.state === 4 ? "Settled agreement amount" : "Held by the escrow contract"}</span></div><dl className="detail-list"><div><dt>BUYER {buyer ? "· YOU" : ""}</dt><dd><a href={addressUrl(current.buyer)} target="_blank" rel="noreferrer"><ChainText>{current.buyer}</ChainText></a></dd></div><div><dt>SELLER {seller ? "· YOU" : ""}</dt><dd><a href={addressUrl(current.seller)} target="_blank" rel="noreferrer"><ChainText>{current.seller}</ChainText></a></dd></div><div><dt>TERMS HASH</dt><dd><ChainText>{current.termsHash}</ChainText><p className="field-help">The original order text is not stored on-chain.</p></dd></div><div><dt>FULFILMENT DEADLINE</dt><dd>{utc(current.fulfilBy)}<p className="mono countdown"><Icon name="clock" size={14} /><Countdown deadline={current.fulfilBy} /></p></dd></div></dl></section>
      <aside>{action && now !== undefined ? <SignaturePanel key={`${id}-${action}`} id={id} action={action} now={now} afterSend={refresh} /> : <section className="panel action-panel"><p className="eyebrow">NEXT ACTION</p><h2>{current.state === 3 ? "Payment released." : current.state === 4 ? "Payment refunded." : "Every step, authorised."}</h2>
        {seller && current.state === 1 && now !== undefined && now < current.fulfilBy ? <><p>Mark fulfilment only once you have completed the agreed work. The buyer must then authorise release.</p><button className="button primary full-width" disabled={!canSend || tx.busy} onClick={async () => { const receipt = await tx.submit(encodeFunctionData({ abi: rewindAbi, functionName: "markFulfilled", args: [id] })); if (receipt) refresh(); }}><Icon name="check" />MARK FULFILLED</button><TransactionStatus tx={tx} /></> : <p>{current.state === 3 ? "The escrow paid the stored seller. This agreement is terminal." : current.state === 4 ? "The escrow paid the stored buyer. This agreement is terminal." : !address ? "Connect the stored buyer or seller wallet to see available actions." : !canSend ? "Switch to QoreChain testnet to act on this agreement." : buyer && current.state === 1 ? "The seller can mark fulfilment before the deadline. If it remains unfulfilled, you can authorise a refund after the deadline." : seller && current.state === 2 ? "Waiting for the buyer's post-quantum authorisation to release payment." : seller && current.state === 1 ? "The fulfilment deadline has passed. The buyer can authorise a refund." : "Only the stored buyer and seller can act on this agreement."}</p>}
        {head.isPending && <p>Reading chain time…</p>}{head.error && <p role="alert">Chain time is unavailable; actions remain disabled.</p>}<p className="field-help">A fulfilled agreement has no timeout refund. No admin can intervene.</p></section>}</aside>
    </div><section className="panel timeline-panel"><div className="panel-heading"><h2>On-chain timeline</h2><span className="eyebrow">CONTRACT EVENTS</span></div>{timeline.isPending ? <p>Reading contract events…</p> : timeline.error ? <Notice error>{safeError(timeline.error)} <button className="inline-button" onClick={() => void timeline.refetch()}>Retry</button></Notice> : timeline.data?.logs.length ? <ol className="timeline">{timeline.data.logs.map((log) => <li key={`${log.transactionHash}-${log.logIndex}`}><span className="timeline-dot" /><div><h3>{labels[log.eventName ?? ""] ?? "Contract event"}</h3><p className="mono">BLOCK {log.blockNumber.toString()}</p></div><a href={transactionUrl(log.transactionHash)} target="_blank" rel="noreferrer" className="mono">{short(log.transactionHash)} <Icon name="external" size={13} /></a></li>)}</ol> : <Empty title="No events in this range">This agreement may be older than the recent scan. Its stored details above are read directly from the contract.</Empty>}<p className="field-help">History covers the most recent {RECENT_BLOCKS.toLocaleString()} blocks{timeline.data ? ` (${timeline.data.fromBlock}–${timeline.data.toBlock})` : ""}; older events may be absent. Explorer links show the full transaction record.</p></section></>}
  </>;
}
