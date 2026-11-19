import { useState } from "react";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { CONTRACT, publicClient } from "./config.js";
import { rewindAbi } from "./abi/rewind.js";
import { recentEvents, RECENT_BLOCKS } from "./chain.js";
import { Badge, Empty, Icon, Notice } from "./components.js";
import { qor, safeError, sameAddress, short, states, utc } from "./lib.js";

export function MyPayments({ navigate }: { navigate: (path: string) => void }) {
  const { address } = useAccount(); const [filter, setFilter] = useState("All");
  const query = useQuery({ queryKey: ["my-payments", CONTRACT, address], enabled: address !== undefined, retry: 1, refetchInterval: 60000,
    queryFn: async () => {
      const history = await recentEvents(undefined, address!);
      const ids = [...new Set(history.logs.flatMap((log) => log.args.id === undefined ? [] : [log.args.id]))];
      const payments = await Promise.all(ids.map(async (id) => ({ id, agreement: await publicClient.readContract({ address: CONTRACT, abi: rewindAbi, functionName: "getAgreement", args: [id] }) })));
      return { ...history, payments: payments.sort((a, b) => a.id > b.id ? -1 : 1) };
    },
  });
  const payments = query.data?.payments.filter(({ agreement }) => filter === "All" || states[agreement.state] === filter);
  return <><div className="page-heading compact"><div><p className="eyebrow">02 / MY PAYMENTS</p><h1>Your agreements.<br />One clear view.</h1><p className="lede">Payments where your connected wallet is the buyer or seller.</p></div><a className="button primary" href="/" onClick={(event) => { event.preventDefault(); navigate("/"); }}><Icon name="plus" />NEW PAYMENT</a></div>
    <section className="panel payments-panel"><div className="panel-heading"><div className="filter-tabs" aria-label="Filter payments by state">{["All", "Funded", "Fulfilled", "Released", "Refunded"].map((state) => <button type="button" key={state} aria-pressed={state === filter} className={state === filter ? "selected" : ""} onClick={() => setFilter(state)}>{state}</button>)}</div><span className="eyebrow">{query.data ? `${query.data.payments.length} AGREEMENTS` : "ON-CHAIN RECORDS"}</span></div>
      {!address ? <Empty title="Your wallet is your payment list."><span>Connect to find your agreements on testnet.</span><span className="empty-action"><ConnectButton /></span></Empty> : query.isPending ? <div className="loading-panel" role="status">Scanning recent AgreementCreated events…</div> : query.error ? <Notice error>{safeError(query.error)} <button className="inline-button" onClick={() => void query.refetch()}>Retry scan</button></Notice> : !payments?.length ? <Empty title={filter === "All" ? "No payments found in this range." : `No ${filter.toLowerCase()} payments.`}>Try another filter, create a payment, or open an older agreement by its ID.</Empty> : <div className="table-scroll"><table className="payments-table"><thead><tr><th>PAYMENT</th><th>YOUR ROLE</th><th>COUNTERPARTY</th><th>AMOUNT</th><th>STATE</th><th>DEADLINE · UTC</th></tr></thead><tbody>{payments.map(({ id, agreement }) => <tr key={id.toString()}><td><a href={`/payment/${id}`} onClick={(event) => { event.preventDefault(); navigate(`/payment/${id}`); }} className="payment-link">#{id.toString().padStart(4, "0")} <Icon name="arrow" size={14} /></a></td><td>{sameAddress(address, agreement.buyer) ? "Buyer" : "Seller"}</td><td><code title={sameAddress(address, agreement.buyer) ? agreement.seller : agreement.buyer}>{short(sameAddress(address, agreement.buyer) ? agreement.seller : agreement.buyer)}</code></td><td className="amount-cell">{qor(agreement.amount)} <span>QOR</span></td><td><Badge state={agreement.state} /></td><td className="mono">{utc(agreement.fulfilBy)}</td></tr>)}</tbody></table></div>}
      <div className="panel-foot"><p>Scan coverage: most recent {RECENT_BLOCKS.toLocaleString()} blocks{query.data ? ` (${query.data.fromBlock}–${query.data.toBlock})` : ""}. Older agreements may be absent.</p><a href="/payment" onClick={(event) => { event.preventDefault(); navigate("/payment"); }}>Find by agreement ID <Icon name="arrow" size={13} /></a></div>
    </section>
  </>;
}
