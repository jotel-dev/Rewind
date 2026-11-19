import { useId } from "react";

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

export function AgreementArt({ compact = false }: { compact?: boolean }) {
  const id = useId();
  const fill = (name: string) => `url(#${id}-${name})`;
  return (
    <svg className={`agreement-art${compact ? " agreement-art-small" : ""}`} viewBox={compact ? "158 8 315 300" : "0 0 640 330"} fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={id + "-glass"} x2=".84" y2="1">
          <stop stopColor="#f7fbff" stopOpacity=".96" /><stop offset=".38" stopColor="#86a6f8" stopOpacity=".8" />
          <stop offset=".72" stopColor="#b4cbff" stopOpacity=".72" /><stop offset="1" stopColor="#eff6ff" stopOpacity=".92" />
        </linearGradient>
        <linearGradient id={id + "-rim"} x2="1" y2="1">
          <stop stopColor="#829dff" /><stop offset=".33" stopColor="#fff" /><stop offset=".7" stopColor="#6f91f7" /><stop offset="1" stopColor="#f1f9ff" />
        </linearGradient>
        <linearGradient id={id + "-orbit"} x2="1" y2=".8">
          <stop stopColor="#71caff" /><stop offset=".48" stopColor="#9ac9ff" stopOpacity=".3" /><stop offset="1" stopColor="#3154ee" />
        </linearGradient>
        <linearGradient id={id + "-label"} x2=".8" y2="1">
          <stop stopColor="#fbfdff" stopOpacity=".86" /><stop offset=".58" stopColor="#e5edff" stopOpacity=".5" /><stop offset="1" stopColor="#f9fbff" stopOpacity=".93" />
        </linearGradient>
        <radialGradient id={id + "-glow"}>
          <stop stopColor="#4879fc" stopOpacity=".48" /><stop offset="1" stopColor="#7b9bff" stopOpacity="0" />
        </radialGradient>
      </defs>
      {!compact && <>
        <ellipse cx="326" cy="268" rx="276" ry="60" fill={fill("glow")} />
        <ellipse cx="321" cy="192" rx="288" ry="82" transform="rotate(-8 321 192)" stroke={fill("orbit")} strokeWidth="2.5" />
        <ellipse className="agreement-orbit-glint" cx="321" cy="192" rx="288" ry="82" transform="rotate(-8 321 192)" pathLength="100" stroke="#dbf5ff" strokeWidth="3.8" />
      </>}
      <g className="agreement-board">
        <path d="M163 276 249 72q6-14 24-18L467 13q16-2 12 18l-86 240q-7 20-31 21l-182 1q-19 0-17-17Z" fill={fill("rim")} opacity=".8" />
        <path d="M156 265 240 70q7-16 27-21L458 8q18-4 14 15l-86 239q-7 20-29 20H173q-24 0-17-17Z" fill={fill("glass")} stroke={fill("rim")} strokeWidth="2.7" />
        <path d="m160 263 86-192q7-14 25-18l185-39q12-3 13 5M169 275h188q18 0 24-15" stroke="#f6fcff" strokeOpacity=".77" strokeWidth="2.4" />
        <image href="/brand/rewind-mark-white.png" x="255" y="70" width="58" height="58" opacity=".93" />
        <g transform="translate(232 161) skewX(-15) rotate(-7)">
          <rect x="-3" y="4" width="189" height="69" rx="15" fill={fill("rim")} opacity=".75" />
          <rect width="186" height="67" rx="14" fill={fill("label")} stroke="#ecf5ff" strokeWidth="1.8" />
          <path d="M24 40v-7m10 7V26m10 14V19" stroke="#2160f8" strokeWidth="6" strokeLinecap="round" />
          <text x="57" y="41" fill="#172344" fontFamily="Inter, Arial, sans-serif" fontSize="19" fontWeight="700">Agreements</text>
        </g>
        {!compact && <path d="M391 106v13m-6.5-6.5h13" stroke="#fff" strokeWidth="2" strokeLinecap="round" />}
      </g>
      {!compact && <>
        <path d="M43 211q25 32 124 48m245 5q97-11 153-40" stroke={fill("orbit")} strokeWidth="2" />
        <g className="agreement-token">
          <g transform="translate(151 234) rotate(34)">
            <ellipse cy="7" rx="40" ry="24" fill="#2058ee" />
            <ellipse rx="40" ry="23" fill={fill("glass")} stroke="#99cdff" strokeWidth="3" />
            <ellipse rx="32" ry="17" stroke="#3471ff" strokeWidth="2" />
            <path d="M-14 2h26m-6-5 6 5-6 5m-12-8h-8m0 0 5-5m-5 5 5 4" stroke="#2856de" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </g>
        <g className="agreement-shield">
          <path d="M511 187q24 13 48 11v26q-3 41-46 63-45-12-48-53v-26q26-5 46-21Z" fill={fill("rim")} opacity=".85" />
          <path d="M505 183q23 12 46 12v27q-3 40-44 61-44-13-46-52v-26q24-6 44-22Z" fill={fill("label")} stroke="#f4fbff" strokeWidth="2" />
          <path d="m484 231 14 13 28-30" stroke="#2d62f6" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </>}
    </svg>
  );
}
