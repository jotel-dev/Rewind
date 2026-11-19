import { useState } from "react";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { CONTRACT, publicClient } from "./config.js";
import { rewindAbi } from "./abi/rewind.js";
import { recentEvents, RECENT_BLOCKS } from "./chain.js";
import { Badge, Icon, Notice } from "./components.js";
import { qor, safeError, sameAddress, short, states, utc } from "./lib.js";
import { PaymentCardsArt } from "./PaymentArtwork.js";

const filters = ["All", "Funded", "Fulfilled", "Released", "Refunded"] as const;

export function MyPayments({ navigate }: { navigate: (path: string) => void }) {
  const { address, chainId } = useAccount(); const [filter, setFilter] = useState("All");
  const query = useQuery({ queryKey: ["my-payments", CONTRACT, address], enabled: address !== undefined, retry: 1, refetchInterval: 60000,
    queryFn: async () => {
      const history = await recentEvents(undefined, address!);
      const ids = [...new Set(history.logs.flatMap((log) => log.args.id === undefined ? [] : [log.args.id]))];
      const payments = await Promise.all(ids.map(async (id) => ({ id, agreement: await publicClient.readContract({ address: CONTRACT, abi: rewindAbi, functionName: "getAgreement", args: [id] }) })));
      return { ...history, payments: payments.sort((a, b) => a.id > b.id ? -1 : 1) };
    },
  });
  const payments = query.data?.payments.filter(({ agreement }) => filter === "All" || states[agreement.state] === filter)
    .map(({ id, agreement }) => {
      const buyer = sameAddress(address, agreement.buyer);
      return { id, agreement, role: buyer ? "Buyer" : "Seller", counterparty: buyer ? agreement.seller : agreement.buyer };
    });
  const wrongNetwork = Boolean(address && chainId !== 9800);
  const showCount = Boolean(address && !wrongNetwork && query.data && !query.error);
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
    <div className="payment-glass-page">
      <section className="payment-hero payments-hero" aria-labelledby="payments-title">
        <div>
          <p className="eyebrow">02 / MY PAYMENTS</p>
          <h1 id="payments-title">Your agreements.<br /><mark>One clear view.</mark></h1>
          <p className="payment-lede">Payments where your connected wallet is the buyer or seller.</p>
          {newPayment("New payment")}
        </div>
        <PaymentCardsArt />
      </section>

      <section className="security-glass payment-dashboard" aria-labelledby="records-title">
        <div className="payment-card-heading">
          <h2 id="records-title">Payment records</h2>
          {showCount && <span className="payment-chip">{query.data!.payments.length} in scan range</span>}
        </div>
        <div className="payment-filters" role="group" aria-label="Filter payments by state">
          {filters.map((state) => (
            <button type="button" key={state} aria-pressed={state === filter} onClick={() => setFilter(state)}>{state}</button>
          ))}
        </div>
        {!address ? (
          <div className="payment-empty">
            <PaymentCardsArt compact />
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
          <div className="payment-empty"><PaymentCardsArt compact />
            <h3>No payments yet.</h3><p>Your agreements will appear here once you create or participate in a payment.</p>
            {newPayment("Create your first payment")}
          </div>
        ) : !payments?.length ? (
          <div className="payment-empty"><Icon name="wallet" size={28} />
            <h3>No {filter.toLowerCase()} payments.</h3><p>Choose another filter to see other agreements in the scan range.</p>
            <button className="button" type="button" onClick={() => setFilter("All")}>Show all payments</button>
          </div>
        ) : (
          <>
            <table className="payment-records">
              <thead><tr><th scope="col">Payment</th><th scope="col">Your role</th><th scope="col">Counterparty</th><th scope="col">Amount</th><th scope="col">State</th><th scope="col">Deadline · UTC</th></tr></thead>
              <tbody>
                {payments.map(({ id, agreement, role, counterparty }) => (
                  <tr key={id.toString()}>
                    <td>{paymentLink(id, `#${id.toString().padStart(4, "0")}`)}</td>
                    <td>{role}</td><td><code title={counterparty}>{short(counterparty)}</code></td>
                    <td className="amount-cell">{qor(agreement.amount)} QOR</td>
                    <td><Badge state={agreement.state} /></td><td>{utc(agreement.fulfilBy)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="payment-record-cards">
              {payments.map(({ id, agreement, role, counterparty }) => (
                <li key={id.toString()}>
                  <div className="record-card-heading"><h3>{qor(agreement.amount)} QOR</h3><Badge state={agreement.state} /></div>
                  <dl><div><dt>Your role</dt><dd>{role}</dd></div><div><dt>Counterparty</dt><dd><code>{counterparty}</code></dd></div>
                    <div><dt>Deadline</dt><dd>{utc(agreement.fulfilBy)}</dd></div></dl>
                  {paymentLink(id, `View payment #${id}`)}
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="panel-foot">
          <p>Scan coverage: most recent {RECENT_BLOCKS.toLocaleString()} blocks{showCount ? ` (${query.data!.fromBlock}–${query.data!.toBlock})` : ""}. Older agreements may be absent.</p>
          <a href="/payment" onClick={(event) => { event.preventDefault(); navigate("/payment"); }}>Find by agreement ID <Icon size={13} /></a>
        </div>
      </section>
    </div>
  );
}
