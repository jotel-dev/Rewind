import { useAgreement, useRecentAgreements, RECENT_BLOCKS } from "./chain.js";
import { Badge, Icon, Notice } from "./components.js";
import { qor, short } from "./lib.js";
import "./recent-agreements.css";

type Navigation = { navigate: (path: string) => void };

export function RecentAgreements({ navigate, compact = false }: Navigation & { compact?: boolean }) {
  const query = useRecentAgreements(compact ? 5 : undefined);
  return (
    <section className={`security-glass recent-agreements${compact ? " recent-agreements-compact" : ""}`} aria-labelledby="recent-agreements-title">
      <div className="payment-card-heading">
        <div><h2 id="recent-agreements-title">Recent agreements on this contract</h2><p>Public testnet activity. No wallet needed.</p></div>
        {compact && <a href="/payments" onClick={(event) => { event.preventDefault(); navigate("/payments"); }}>View more <Icon size={14} /></a>}
      </div>
      {query.isPending ? <p role="status">Loading recent agreements…</p>
        : query.error ? <Notice error>Could not load recent agreements from testnet.
          <button className="inline-button" type="button" onClick={() => void query.refetch()}>Retry scan</button>
        </Notice>
        : !query.data?.payments.length ? <p role="status">No agreements found in the recent block range.</p>
        : <ul className="recent-agreement-list">
          {query.data.payments.map(({ id, agreement }) => (
            <li key={id.toString()}>
              <div className="recent-agreement-heading">
                <a href={`/payment/${id}`} onClick={(event) => { event.preventDefault(); navigate(`/payment/${id}`); }}>Payment #{id.toString()} <Icon size={14} /></a>
                <Badge state={agreement.state} />
              </div>
              <strong className="recent-agreement-amount">{qor(agreement.amount)} QOR</strong>
              <dl>
                <div><dt>Buyer</dt><dd><code title={agreement.buyer}>{short(agreement.buyer)}</code></dd></div>
                <div><dt>Seller</dt><dd><code title={agreement.seller}>{short(agreement.seller)}</code></dd></div>
              </dl>
            </li>
          ))}
        </ul>}
      <p className="recent-coverage">{compact ? "Up to 5 newest agreements from the" : "Agreements from the"} most recent {RECENT_BLOCKS.toLocaleString()} blocks{query.data ? ` (${query.data.fromBlock}–${query.data.toBlock})` : ""}. Older agreements may be absent.</p>
    </section>
  );
}

function TestnetExample({ id, navigate }: Navigation & { id: bigint }) {
  const query = useAgreement(id);
  return (
    <div className="testnet-example">
      <a href={`/payment/${id}`} onClick={(event) => { event.preventDefault(); navigate(`/payment/${id}`); }}>Payment #{id.toString()} <Icon size={14} /></a>
      {query.isPending ? <span role="status">Loading state…</span>
        : query.error ? <span role="status">State unavailable <button type="button" className="inline-button" onClick={() => void query.refetch()}>Retry</button></span>
        : query.data && <Badge state={query.data.state} />}
    </div>
  );
}

export function TestnetExamples({ navigate }: Navigation) {
  return (
    <section className="security-glass testnet-examples" aria-labelledby="testnet-examples-title">
      <h2 id="testnet-examples-title">See it on testnet</h2>
      <TestnetExample id={3n} navigate={navigate} />
      <TestnetExample id={2n} navigate={navigate} />
    </section>
  );
}
