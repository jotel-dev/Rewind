import { useId } from "react";
import { Icon } from "./components.js";

export function EscrowVault() {
  const id = useId();
  const fill = (name: string) => `url(#${id}-${name})`;
  return (
    <figure className="escrow-art" aria-label="Escrow lifecycle illustration">
      <svg viewBox="0 0 640 329" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id={id + "-glass"} x2="1" y2="1">
            <stop stopColor="var(--glass-white)" stopOpacity=".9" />
            <stop offset=".43" stopColor="var(--glass-tint)" stopOpacity=".47" />
            <stop offset="1" stopColor="var(--glass-mid)" stopOpacity=".68" />
          </linearGradient>
          <linearGradient id={id + "-edge"} x2="1" y2="1">
            <stop stopColor="var(--glass-white)" /><stop offset=".6" stopColor="#799afa" />
            <stop offset="1" stopColor="var(--glass-white)" />
          </linearGradient>
          <radialGradient id={id + "-blue"}>
            <stop stopColor="#9ccaff" /><stop offset=".52" stopColor="#5989ff" /><stop offset="1" stopColor="#1b45cc" />
          </radialGradient>
          <radialGradient id={id + "-ambient"}>
            <stop stopColor="#5180fc" stopOpacity=".48" /><stop offset="1" stopColor="#7499ff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="328" cy="267" rx="248" ry="56" fill={fill("ambient")} />
        <path d="M88 227C131 217 166 204 222 181M411 171c53 16 92 41 141 59" stroke="#6295ff" strokeWidth="2" strokeDasharray="3 6" />
        <g className="escrow-vault">
          <path d="M211 216 303 177q13-5 27-1l119 32q15 5 0 14l-105 53q-12 7-29 2l-111-31q-17-5-15-14v-9z" fill={fill("edge")} opacity=".82" />
          <path d="m194 223 109-51q13-5 27-1l121 34q14 5 0 12l-109 53q-12 6-28 1l-116-34q-14-4-4-14z" fill={fill("glass")} stroke={fill("edge")} strokeWidth="2" />
          <path d="M215 112 307 72q13-6 29-1l95 27q13 4 13 19v95q0 10-12 16l-89 42q-11 5-23 2l-108-31q-12-3-12-17v-96q0-12 15-16Z" fill={fill("glass")} stroke={fill("edge")} strokeWidth="2" />
          <path d="m204 120 119 35 116-53m-116 53v116" stroke={fill("edge")} strokeWidth="2" />
          <path d="m226 138 77 26v62l-77-22z" fill={fill("glass")} opacity=".58" />
          <g transform="translate(325 168) rotate(-17)">
            <ellipse cx="7" rx="35" ry="45" fill="#2753dd" />
            <ellipse rx="35" ry="45" fill={fill("blue")} stroke="#b5d4ff" strokeWidth="2" />
            <ellipse rx="27" ry="36" stroke="#c7deff" strokeOpacity=".75" />
            <path d="M0-20q7 8 16 8v11C16 9 9 16 0 21-10 16-16 8-16-1v-11q9 0 16-8Z" stroke="#e0efff" strokeWidth="2" />
            <path d="m-7-1 5 6 9-11" stroke="#e0efff" strokeWidth="2" strokeLinecap="round" />
          </g>
          <path d="M296 105V91a25 25 0 0 1 50 0v23" stroke={fill("edge")} strokeWidth="10" />
          <path d="m285 104 60 14q9 2 9 11v27q0 9-9 7l-61-14q-8-2-8-11v-27q0-9 9-7z" fill={fill("glass")} stroke={fill("edge")} strokeWidth="2" />
          <path d="M315 128v12" stroke="#4573ed" strokeWidth="3" strokeLinecap="round" />
        </g>
        <g stroke={fill("edge")} strokeWidth="2" fill={fill("glass")}>
          <path d="M51 216 88 201l36 12q9 4 0 8l-36 16-37-12q-9-3 0-9Z" />
          <path d="m514 223 36-15 38 12q8 4 0 8l-38 16-36-12q-8-3 0-9Z" />
        </g>
        <circle cx="88" cy="217" r="5" fill="#5788ff" /><circle cx="550" cy="224" r="5" fill="#5788ff" />
        <g className="escrow-endpoints" textAnchor="middle" fontSize="17" fontWeight="600">
          <text x="88" y="259">Buyer</text><text x="550" y="266">Seller</text>
        </g>
      </svg>
      <figcaption className="escrow-labels" aria-label="Illustrative stages">
        <span>Agreement created</span><span>Funds locked</span><span>Release authorised</span>
      </figcaption>
    </figure>
  );
}

export function PaymentCardsArt({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`payment-cards-art${compact ? " is-compact" : ""}`} aria-hidden="true">
      <div className="payment-art-card"><span />{!compact && "Funded"}</div>
      <div className="payment-art-card"><span />{!compact && "Fulfilled"}</div>
      <div className="payment-art-card"><span />{!compact && "Released"}</div>
      <div className="payment-art-icon"><Icon name="wallet" size={compact ? 24 : 38} /></div>
    </div>
  );
}
