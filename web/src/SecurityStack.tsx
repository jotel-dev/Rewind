import { useId, useState } from "react";

const stages = [
  { name: "Lock", subtitle: "Secure funds", detail: "The buyer deposits QOR into the contract. The agreement records the buyer, seller, amount, terms hash and fulfilment deadline." },
  { name: "Verify", subtitle: "Check agreement", detail: "Only the stored seller can mark fulfilment before the deadline. The contract verifies the buyer’s signed agreement digest at settlement." },
  { name: "Release", subtitle: "Send when authorised", detail: "After fulfilment, only the buyer can release funds to the stored seller with a valid ML-DSA-87 signature." },
] as const;

const slab = "M18 63 Q5 72 25 80 L254 125 Q282 131 301 120 L405 57 Q426 43 399 36 L179 1 Q158 -3 137 7 Z";

function GlassSlab({ shade }: { shade: number }) {
  const id = useId();
  return (
    <svg className="glass-slab" viewBox="0 0 424 145" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={id + "-face"} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="var(--glass-white)" stopOpacity=".97" />
          <stop offset=".34" stopColor="var(--glass-tint)" stopOpacity=".86" />
          <stop offset=".71" stopColor="var(--glass-mid)" stopOpacity={.55 + shade * .1} />
          <stop offset="1" stopColor="var(--glass-white)" stopOpacity=".94" />
        </linearGradient>
        <linearGradient id={id + "-rim"}>
          <stop stopColor="#829eff" /><stop offset=".1" stopColor="var(--glass-white)" />
          <stop offset=".63" stopColor="#9db8ff" /><stop offset=".71" stopColor="var(--glass-white)" />
          <stop offset="1" stopColor="#6284f2" />
        </linearGradient>
      </defs>
      <path d={slab} transform="translate(0 13)" fill={`url(#${id}-rim)`} opacity=".85" />
      <path d={slab} fill={`url(#${id}-face)`} stroke="var(--glass-white)" strokeWidth="2" />
    </svg>
  );
}

function GlassSeal({ lock = false }: { lock?: boolean }) {
  const id = useId();
  return (
    <svg className={lock ? "glass-padlock" : "glass-shield"} viewBox={lock ? "0 0 150 178" : "0 0 100 107"} fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={id + "-edge"} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#f6fbff" /><stop offset=".38" stopColor="#5978dd" />
          <stop offset=".69" stopColor="#a6c4ff" /><stop offset="1" stopColor="#effaff" />
        </linearGradient>
        <linearGradient id={id + "-glass"} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="var(--glass-white)" stopOpacity=".95" />
          <stop offset=".42" stopColor="#8da8ff" stopOpacity=".72" />
          <stop offset=".77" stopColor="#4269e5" stopOpacity=".62" />
          <stop offset="1" stopColor="var(--glass-white)" stopOpacity=".9" />
        </linearGradient>
      </defs>
      {lock ? <>
        <path d="M38 78V56C38 2 117 6 117 63V89" stroke={`url(#${id}-edge)`} strokeWidth="23" />
        <path d="M35 78V55C35 4 114 7 114 62V89" stroke="#ecf5ff" strokeOpacity=".68" strokeWidth="2" />
        <path d="M14 81Q14 69 30 69L127 83Q142 85 142 99V153Q142 169 127 170L29 155Q14 153 14 141Z" fill={`url(#${id}-glass)`} stroke={`url(#${id}-edge)`} strokeWidth="3" />
        <path d="M15 82Q16 73 28 75L123 89Q132 91 132 100V154Q132 165 123 164" stroke="#edf6ff" strokeWidth="2" opacity=".78" />
        <path d="M74 96Q84 108 100 110V125Q98 143 75 150Q53 137 52 120V104Q67 103 74 96Z" fill="#204fe2" stroke="#709cff" />
        <path d="m63 120 9 10 17-16" stroke="#c3e5ff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </> : <>
        <path d="M49 4Q69 17 93 15L94 39Q92 77 53 102Q12 84 8 52L7 30Q29 22 49 4Z" fill={`url(#${id}-edge)`} />
        <path d="M45 5Q64 19 86 17L87 39Q84 75 48 96Q11 81 10 51L9 31Q29 23 45 5Z" fill={`url(#${id}-glass)`} stroke="#dcecff" strokeWidth="2" />
        <path d="m29 52 15 13 23-30" stroke="#1849df" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      </>}
    </svg>
  );
}

export function SecurityStack() {
  const descriptionId = useId();
  const [selected, setSelected] = useState(0);
  const [hovered, setHovered] = useState<number>();
  const active = hovered ?? selected;
  return (
    <figure className="security-stack">
      <div className="stack-scene" role="group" aria-label="Escrow security stages">
        <svg className="stack-orbit" viewBox="0 0 640 430" fill="none" aria-hidden="true">
          <ellipse cx="318" cy="232" rx="296" ry="85" transform="rotate(-16 318 232)" />
          <ellipse className="orbit-glint" cx="318" cy="232" rx="296" ry="85" transform="rotate(-16 318 232)" pathLength="100" />
        </svg>
        <div className="stack-cap" aria-hidden="true"><GlassSlab shade={0} /><GlassSeal lock /></div>
        {stages.map((stage, index) => (
          <button
            key={stage.name}
            type="button"
            className={`stack-stage stage-${index} ${active === index ? "stage-active" : ""}`}
            aria-label={`${stage.name}: ${stage.subtitle}`}
            aria-pressed={selected === index}
            aria-describedby={selected === index ? descriptionId : undefined}
            onPointerEnter={(event) => { if (event.pointerType === "mouse") setHovered(index); }}
            onPointerLeave={() => setHovered(undefined)}
            onFocus={() => setHovered(index)}
            onBlur={() => setHovered(undefined)}
            onClick={() => { setSelected(index); setHovered(undefined); }}
          >
            <GlassSlab shade={index} />
            <span className="stage-label">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {index === 0 ? <path d="m12 2 9 5v10l-9 5-9-5V7Zm0 20V12m-9-5 9 5 9-5" /> : index === 1 ? <><circle cx="12" cy="12" r="9" /><path d="m7.5 12 3 3 6-6" /></> : <><ellipse cx="12" cy="6" rx="8" ry="4" /><path d="M4 6v12c0 5 16 5 16 0V6M4 10c0 5 16 5 16 0M4 14c0 5 16 5 16 0" /></>}
              </svg>
              <span><strong>{stage.name}</strong><small>{stage.subtitle}</small></span>
            </span>
          </button>
        ))}
        <GlassSeal />
      </div>
      <figcaption className="stack-explanation" id={descriptionId} aria-live={hovered === undefined ? "polite" : "off"}>
        <strong>{stages[active].name}</strong> {stages[active].detail}
      </figcaption>
    </figure>
  );
}
