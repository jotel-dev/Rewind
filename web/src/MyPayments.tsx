import { useState } from "react";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { CONTRACT, publicClient } from "./config.js";
import { rewindAbi } from "./abi/rewind.js";
import { recentEvents, RECENT_BLOCKS } from "./chain.js";
import { Icon, Notice } from "./components.js";
import { paymentId, qor, safeError, sameAddress, short, states, utc } from "./lib.js";
import { RecentAgreements } from "./RecentAgreements.js";
import { GlassWallet } from "./PaymentArtwork.js";
import "./my-payments.css";

const filters = ["All", "Funded", "Fulfilled", "Released", "Refunded"] as const;
type PaymentFilter = typeof filters[number];

function DashboardIcon({ name }: { name: PaymentFilter | "search" | "copy" | "filter" }) {
  const paths = {
    All: "M4 6a8 3 0 1 0 16 0A8 3 0 1 0 4 6Zm0 0v12a8 3 0 0 0 16 0V6M4 10a8 3 0 0 0 16 0M4 14a8 3 0 0 0 16 0",
    Funded: "m12 2 9 5v10l-9 5-9-5V7Zm0 10 9-5M3 7l9 5v10",
    Fulfilled: "M21 12a9 9 0 1 1-5-8m-9 8 4 4L21 6",
    Released: "m12 2 10 5-10 5L2 7Zm-9 9 9 5 9-5M3 15l9 5 9-5",
    Refunded: "M8 6 3 11l5 5M3 11h13a4 4 0 0 1 0 8",
    search: "M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm5-2 5 5",
    copy: "M8 15H4V3h12v4m-8 0h12v14H8Z",
    filter: "M3 4h18l-7 8v6l-4 2v-8Z",
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

function DashboardBadge({ state }: { state: number }) {
  return <span className={`dashboard-badge tone-${states[state]?.toLowerCase()}`}><i />{states[state] ?? "Unknown"}</span>;
}

export function MyPayments({ navigate }: { navigate: (path: string) => void }) {
  const { address, chainId } = useAccount();
  const [filter, setFilter] = useState<PaymentFilter>("All");
  const [search, setSearch] = useState("");
  const [copyFeedback, setCopyFeedback] = useState("");
  const [openId, setOpenId] = useState("");
  const [idError, setIdError] = useState("");
  const query = useQuery({ queryKey: ["my-payments", CONTRACT, address], enabled: address !== undefined, retry: 1, refetchInterval: 60000,
    queryFn: async () => {
      const history = await recentEvents(undefined, address!);
      const ids = [...new Set(history.logs.flatMap((log) => log.args.id === undefined ? [] : [log.args.id]))];
      const payments = await Promise.all(ids.map(async (id) => ({ id, agreement: await publicClient.readContract({ address: CONTRACT, abi: rewindAbi, functionName: "getAgreement", args: [id] }) })));
      return { ...history, payments: payments.sort((a, b) => a.id > b.id ? -1 : 1) };
    },
  });
  const wrongNetwork = Boolean(address && chainId !== 9800);
  const records = address && !wrongNetwork && !query.error ? query.data : undefined;
  const loading = Boolean(address && !wrongNetwork && query.isPending);
  const stats = records?.payments.reduce((counts, { agreement }) => {
    const state = states[agreement.state];
    if (state && state !== "None") counts[state]++;
    counts.All++;
    return counts;
  }, { All: 0, Funded: 0, Fulfilled: 0, Released: 0, Refunded: 0 });
  const term = search.trim().toLowerCase().replace(/^#/, "");
  const payments = records?.payments.flatMap(({ id, agreement }) => {
    const buyer = sameAddress(address, agreement.buyer);
    const counterparty = buyer ? agreement.seller : agreement.buyer;
    if (filter !== "All" && states[agreement.state] !== filter) return [];
    if (term && !id.toString().includes(term) && !id.toString().padStart(4, "0").includes(term) && !counterparty.toLowerCase().includes(term)) return [];
    return [{ id, agreement, role: buyer ? "Buyer" : "Seller", counterparty }];
  });
  async function copyAddress(counterparty: string) {
    try {
      await navigator.clipboard.writeText(counterparty);
      setCopyFeedback("Counterparty address copied.");
    } catch {
      setCopyFeedback("Could not copy the address. You can select it on the payment detail page.");
    }
  }
  const copyButton = (counterparty: string) => (
    <button className="address-copy" type="button" aria-label={`Copy counterparty address ${counterparty}`}
      onClick={() => void copyAddress(counterparty)}><DashboardIcon name="copy" /></button>
  );
  const newPayment = (label: string) => (
    <a className="button primary payment-primary" href="/" onClick={(event) => { event.preventDefault(); navigate("/"); }}>
      <Icon name="plus" />{label}
    </a>
  );
  const paymentLink = (id: bigint, label: string) => (
    <a href={`/payment/${id}`} onClick={(event) => { event.preventDefault(); navigate(`/payment/${id}`); }} className="payment-link">
      {label} <Icon size={15} />
    </a>
  );

  return (
    <div className="payment-glass-page my-payments-page">
      <section className="payment-hero payments-hero" aria-labelledby="payments-title">
        <div>
          <p className="eyebrow">02 / MY PAYMENTS</p>
          <h1 id="payments-title">Your agreements.<br />One clear view.</h1>
          <p className="payment-lede">Payments where your connected wallet is the buyer or seller.</p>
          {newPayment("New payment")}
        </div>
        <GlassWallet />
      </section>

      <section className="payment-stats" aria-label="Payment statistics for the recent scan">
        {filters.slice(0, 4).map((state) => (
          <div key={state} className={`security-glass payment-stat tone-${state.toLowerCase()}`}>
            <DashboardIcon name={state} />
            <div>
              <strong>{loading ? <span className="stat-skeleton" aria-label="Loading count" /> : stats?.[state] ?? <span aria-label="Count unavailable">—</span>}</strong>
              <span>{state === "All" ? "Total payments" : state}</span>
            </div>
          </div>
        ))}
      </section>

      <section className="security-glass payment-dashboard" aria-labelledby="records-title">
        <div className="payment-card-heading">
          <h2 id="records-title">Payment records</h2>
          <div className="record-controls">
            <label className="record-search">
              <DashboardIcon name="search" />
              <input type="search" aria-label="Search payments by ID or counterparty address" placeholder="Search payments…" value={search} onChange={(event) => setSearch(event.target.value)} />
            </label>
            <label className="record-status-select">
              <DashboardIcon name="filter" />
              <select aria-label="Filter by payment status" value={filter} onChange={(event) => setFilter(event.target.value as PaymentFilter)}>
                {filters.map((state) => <option key={state} value={state}>{state === "All" ? "All statuses" : state}</option>)}
              </select>
            </label>
          </div>
        </div>
        <div className="payment-filters" role="group" aria-label="Filter payments by state">
          {filters.map((state) => (
            <button type="button" key={state} className={`tone-${state.toLowerCase()}`} aria-pressed={state === filter} onClick={() => setFilter(state)}>
              {state !== "All" && <i aria-hidden="true" />}{state}{stats && <span>{stats[state]}</span>}
            </button>
          ))}
        </div>
        <p className={copyFeedback ? "copy-feedback" : "sr-only"} role="status">{copyFeedback}</p>
        {!address ? (
          <div className="payment-empty">
            <GlassWallet compact />
            <h3>Connect your wallet</h3><p>Connect to find agreements where you are the buyer or seller.</p>
            <ConnectButton />
          </div>
        ) : wrongNetwork ? (
          <div className="payment-empty"><Icon name="shield" size={28} /><h3>Switch to QoreChain testnet</h3>
            <p>Use the network control above to view your testnet agreements.</p></div>
        ) : query.isPending ? (
          <div className="payment-loading" role="status">
            <p>Scanning recent AgreementCreated events…</p>
            <div aria-hidden="true"><span /><span /><span /></div>
          </div>
        ) : query.error ? (
          <div className="payment-read-error"><Notice error>Could not retrieve payment records. {safeError(query.error)}
            <button className="inline-button" type="button" onClick={() => void query.refetch()}>Retry scan</button>
          </Notice></div>
        ) : !query.data?.payments.length ? (
          <div className="payment-empty"><GlassWallet compact />
            <h3>No payments yet.</h3><p>Your agreements will appear here once you create or participate in a payment.</p>
            {newPayment("Create your first payment")}
          </div>
        ) : !payments?.length ? (
          <div className="payment-empty"><Icon name="wallet" size={28} />
            <h3>{term ? "No matching payments." : `No ${filter.toLowerCase()} payments.`}</h3>
            <p>Clear the search or choose another status to see other agreements in the scan range.</p>
            <button className="button" type="button" onClick={() => { setFilter("All"); setSearch(""); }}>Show all payments</button>
          </div>
        ) : (
          <>
            <table className="payment-records">
              <thead><tr><th scope="col">Payment ID</th><th scope="col">Role</th><th scope="col">Counterparty</th><th scope="col">Amount</th><th scope="col">Status</th><th scope="col">Deadline · UTC</th><th scope="col">Actions</th></tr></thead>
              <tbody>
                {payments.map(({ id, agreement, role, counterparty }) => (
                  <tr key={id.toString()}>
                    <td><strong className="record-id">#{id.toString().padStart(4, "0")}</strong></td>
                    <td><span className={`record-role role-${role.toLowerCase()}`}>{role}</span></td>
                    <td><span className="record-address"><code title={counterparty}>{short(counterparty)}</code>{copyButton(counterparty)}</span></td>
                    <td className="amount-cell">{qor(agreement.amount)} QOR</td>
                    <td><DashboardBadge state={agreement.state} /></td><td>{utc(agreement.fulfilBy)}</td>
                    <td>{paymentLink(id, "View")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="payment-record-cards">
              {payments.map(({ id, agreement, role, counterparty }) => (
                <li key={id.toString()}>
                  <div className="record-card-heading"><h3>{qor(agreement.amount)} QOR</h3><DashboardBadge state={agreement.state} /></div>
                  <dl><div><dt>Your role</dt><dd><span className={`record-role role-${role.toLowerCase()}`}>{role}</span></dd></div><div><dt>Counterparty</dt><dd className="record-address"><code>{counterparty}</code>{copyButton(counterparty)}</dd></div>
                    <div><dt>Deadline</dt><dd>{utc(agreement.fulfilBy)}</dd></div></dl>
                  {paymentLink(id, `View payment #${id}`)}
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="panel-foot">
          <p>Counts and records cover the most recent {RECENT_BLOCKS.toLocaleString()} blocks{records ? ` (${records.fromBlock}–${records.toBlock})` : ""}. Older agreements may be absent.</p>
          <a href="/payment" onClick={(event) => { event.preventDefault(); navigate("/payment"); }}>Find by agreement ID <Icon size={13} /></a>
        </div>
      </section>

      <section className="security-glass open-payment" aria-labelledby="open-payment-title">
        <h2 id="open-payment-title">Open payment by ID</h2>
        <form noValidate onSubmit={(event) => {
          event.preventDefault();
          const id = paymentId(openId.trim());
          if (id === undefined) { setIdError("Enter a positive whole-number payment ID within the uint256 range."); return; }
          setIdError("");
          navigate(`/payment/${id}`);
        }}>
          <label htmlFor="open-payment-id">Payment ID</label>
          <div className="open-payment-controls">
            <input id="open-payment-id" inputMode="numeric" placeholder="e.g. 3" value={openId}
              aria-invalid={Boolean(idError)} aria-describedby={idError ? "open-payment-error" : undefined}
              onChange={(event) => { setOpenId(event.target.value); setIdError(""); }} />
            <button type="submit" className="button primary payment-primary">Open payment <Icon /></button>
          </div>
          {idError && <p className="payment-id-error" id="open-payment-error" role="alert">{idError}</p>}
        </form>
      </section>
      <RecentAgreements navigate={navigate} />
    </div>
  );
}
