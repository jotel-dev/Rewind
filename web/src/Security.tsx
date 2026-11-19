import { CONTRACT, REPO, addressUrl } from "./config.js";
import { ChainText, Icon, Notice } from "./components.js";
import { SecurityStack } from "./SecurityStack.js";
import "./security.css";

export function Security() {
  return (
    <div className="security-page">
      <section className="security-hero" aria-labelledby="security-title">
        <div className="security-intro">
          <p className="eyebrow">03 / SECURITY</p>
          <h1 id="security-title">Know what’s <mark>protected.</mark><br />Know what isn’t.</h1>
          <p className="security-lede">Explicit authorisation. Visible limits.<br />Protection you can inspect, without promises you can’t verify.</p>
          <div className="security-cta">
            <a className="security-primary" href="#security-model">View security model <Icon /></a>
            <a className="security-secondary" href="#verification"><Icon name="shield" /> See verification</a>
          </div>
        </div>
        <SecurityStack />
      </section>

      <section className="security-glass security-boundary" id="security-model" aria-labelledby="boundary-title">
        <div className="security-card-head">
          <h2 id="boundary-title">A precise boundary</h2>
          <span className="eyebrow">ML-DSA-87 / POST-QUANTUM</span>
        </div>
        <div className="security-comparison">
          <section>
            <h3><Icon name="shield" /> Protected by the post-quantum signature</h3>
            <p>Rewind verifies the buyer’s release and refund authorisation through QoreChain’s <code>pqcVerify</code> precompile.</p>
            <p>The signed digest binds the chain, contract, agreement, action, parties, amount, terms hash and expiry.</p>
          </section>
          <section>
            <h3>Not protected</h3>
            <p>The wallet’s ordinary EVM transaction signature remains classical.</p>
            <p>Physical delivery, quality of work and seller honesty are outside the contract. Rewind does not resolve disputes.</p>
          </section>
        </div>
      </section>

      <div className="security-notes">
        <section className="security-glass">
          <p className="eyebrow">TWO DISTINCT LAYERS</p>
          <h2>A window admits.<br />A signature authorises.</h2>
          <p>A native-lane, PQC-authorised EVM window permits ordinary wallet transactions within its block, transaction, target and spending allowances.</p>
          <p>Inside Rewind, release and refund require a separate per-agreement ML-DSA-87 signature. An open window does not replace that check.</p>
          <Notice>Signing happens in your local contracts tool. This browser accepts public signatures only. Never enter a key or recovery phrase.</Notice>
        </section>
        <section className="security-glass">
          <p className="eyebrow">KNOWN LIMITATIONS</p>
          <h2>Read before funding.</h2>
          <ul className="limitations">
            <li>No timeout after fulfilment. The buyer must authorise release. A fulfilled agreement has no unilateral refund.</li>
            <li>A seller contract can block release by reverting when it receives payment.</li>
            <li>The buyer chooses the signature expiry. The contract does not impose a maximum authorisation lifetime.</li>
            <li>The mock used in local tests is deliberately forgeable and is not real cryptography.</li>
            <li>The README lists confirmation of the four-output key-status ABI and real ML-DSA-87 signatures on testnet as validation work. Review the supplied evidence separately.</li>
          </ul>
        </section>
      </div>

      <section className="security-glass security-verification" id="verification">
        <div>
          <p className="eyebrow">VERIFY FOR YOURSELF</p>
          <h2>The code. The evidence. The record.</h2>
          <ChainText>{CONTRACT}</ChainText>
        </div>
        <div className="verification-links">
          <a href={`${REPO}/blob/main/contracts/contracts/Rewind.sol`} target="_blank" rel="noreferrer">Read the contract <Icon name="external" size={15} /></a>
          <a href={`${REPO}/tree/main/docs/evidence`} target="_blank" rel="noreferrer">View evidence <Icon name="external" size={15} /></a>
          <a href={addressUrl(CONTRACT)} target="_blank" rel="noreferrer">Inspect on explorer <Icon name="external" size={15} /></a>
        </div>
      </section>
    </div>
  );
}
