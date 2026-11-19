import { useEffect, useRef, useState } from "react";
import { ConnectButton, RainbowKitProvider, darkTheme, lightTheme } from "@rainbow-me/rainbowkit";
import { useAccount, useSwitchChain } from "wagmi";
import { Icon } from "./components.js";
import { NewPayment } from "./NewPayment.js";
import { Payment } from "./Payment.js";
import { MyPayments } from "./MyPayments.js";
import { Security } from "./Security.js";
import { CONTRACT, REPO, addressUrl } from "./config.js";
import { useHead } from "./chain.js";
import { short } from "./lib.js";
import "./styles.css";

function Brand({ dark }: { dark: boolean }) {
  return <span className="brand"><picture><source media="(max-width: 600px)" srcSet={`/brand/rewind-mark-${dark ? "white" : "black"}.png`} /><img src={`/brand/rewind-logo-${dark ? "white" : "black"}.png`} alt="Rewind" /></picture></span>;
}
export function App() {
  const [path, setPath] = useState(window.location.pathname);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const [dark, setDark] = useState(() => { try { return localStorage.getItem("rewind-theme") === "dark"; } catch { return false; } });
  const { address, chainId, isConnected } = useAccount(); const switcher = useSwitchChain(); const head = useHead();
  useEffect(() => { const onBack = () => setPath(window.location.pathname); window.addEventListener("popstate", onBack); return () => window.removeEventListener("popstate", onBack); }, []);
  useEffect(() => { document.documentElement.dataset.theme = dark ? "dark" : "light"; document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#111111" : "#ffffff"); try { localStorage.setItem("rewind-theme", dark ? "dark" : "light"); } catch { /* Storage may be unavailable. */ } }, [dark]);
  function navigate(to: string) { setMenuOpen(false); window.history.pushState({}, "", to); setPath(to); window.scrollTo(0, 0); document.getElementById("main-content")?.focus(); }
  useEffect(() => { setMenuOpen(false); }, [path]);
  useEffect(() => {
    if (!menuOpen) return;
    document.querySelector<HTMLAnchorElement>("#main-navigation a[aria-current]")?.focus();
    function dismiss(event: KeyboardEvent) {
      if (event.key !== "Escape" || !menuButton.current?.getClientRects().length) return;
      setMenuOpen(false);
      menuButton.current.focus();
    }
    document.addEventListener("keydown", dismiss);
    return () => document.removeEventListener("keydown", dismiss);
  }, [menuOpen]);
  const page = path === "/" ? "new" : path === "/payments" ? "payments" : path === "/security" ? "security" : /^\/payment(?:\/[^/]+)?\/?$/.test(path) ? "payment" : "missing";
  const title = page === "new" ? "New payment" : page === "payments" ? "My payments" : page === "security" ? "Security" : page === "payment" ? "Payment details" : "Page not found";
  useEffect(() => { document.title = `${title} — Rewind`; }, [title]);
  return <RainbowKitProvider theme={dark ? darkTheme({ accentColor: "#2563eb", borderRadius: "none", fontStack: "system" }) : lightTheme({ accentColor: "#111111", borderRadius: "none", fontStack: "system" })}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className={page === "security" ? "site-header security-header" : "site-header"}><div className="header-inner"><a href="/" onClick={(event) => { event.preventDefault(); navigate("/"); }} aria-label="Rewind home"><Brand dark={dark} /></a><nav id="main-navigation" aria-label="Main navigation" className={menuOpen ? "navigation-open" : undefined}>{[{ to: "/", label: "New payment", number: "01", active: page === "new" }, { to: "/payments", label: "My payments", number: "02", active: page === "payments" || page === "payment" }, { to: "/security", label: "Security", number: "03", active: page === "security" }].map((item) => <a key={item.to} href={item.to} aria-current={item.active ? "page" : undefined} onClick={(event) => { event.preventDefault(); navigate(item.to); }}><span className="nav-number">{item.number}</span>{item.label}</a>)}</nav><div className="header-actions"><span className="network-chip mono"><span className="status-dot" />QORECHAIN TESTNET</span><ConnectButton.Custom>{({ account, chain, mounted, openConnectModal, openAccountModal, openChainModal }) => <button type="button" className="button connect-button" disabled={!mounted} onClick={!account ? openConnectModal : chain?.unsupported ? openChainModal : openAccountModal}><Icon name="wallet" size={16} /><span>{!account ? "CONNECT WALLET" : chain?.unsupported ? "WRONG NETWORK" : short(account.address, 4)}</span></button>}</ConnectButton.Custom><button className="icon-button" aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} title={dark ? "Light mode" : "Dark mode"} onClick={() => setDark(!dark)}><Icon name={dark ? "sun" : "moon"} /></button><a className="icon-button code-link" href={REPO} target="_blank" rel="noreferrer" aria-label="View Rewind source on GitHub"><Icon name="code" /></a>{page === "security" && <button ref={menuButton} type="button" className="icon-button security-menu-toggle" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-controls="main-navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><Icon name={menuOpen ? "close" : "menu"} /></button>}</div></div></header>
    {isConnected && chainId !== 9800 && <div className="network-warning" role="alert">Your wallet is on chain {chainId ?? "unknown"}. Rewind uses QoreChain testnet (9800). <button onClick={() => switcher.switchChain({ chainId: 9800 })} disabled={switcher.isPending}>Switch to testnet</button>{switcher.error && <span> Select testnet in your wallet manually if switching is unsupported.</span>}</div>}
    <main id="main-content" tabIndex={-1}><div className="context-bar"><span className="mono"><span className="status-dot" />{head.data ? "READING TESTNET" : head.error ? "TESTNET READ UNAVAILABLE" : "CONNECTING TO TESTNET"}</span>{isConnected && chainId === 9800 && address && <span className="mono">WALLET CONNECTED / {short(address, 4)}</span>}<span className="mono">{head.data ? `BLOCK ${head.data.number.toLocaleString()}` : "READ-ONLY UNTIL YOU APPROVE"}</span></div>
      {page === "new" ? <NewPayment navigate={navigate} /> : page === "payments" ? <MyPayments navigate={navigate} /> : page === "security" ? <Security /> : page === "payment" ? <Payment key={path} rawId={path.split("/")[2] ?? ""} /> : <div className="empty"><h1>Page not found.</h1><a href="/" onClick={(event) => { event.preventDefault(); navigate("/"); }}>Start a new payment</a></div>}
    </main>
    <footer className="site-footer"><div><span className="copyright">© {new Date().getFullYear()} Rewind</span><span className="footer-tagline">Clear terms. Protected payments.</span></div><div className="footer-links"><a href="/security" onClick={(event) => { event.preventDefault(); navigate("/security"); }}>Security</a><a href={`${REPO}/tree/main/docs/evidence`} target="_blank" rel="noreferrer">Evidence <Icon name="external" size={12} /></a><a href={REPO} target="_blank" rel="noreferrer">Source <Icon name="external" size={12} /></a></div><a href={addressUrl(CONTRACT)} target="_blank" rel="noreferrer" className="footer-contract mono">CONTRACT / {CONTRACT}</a><span className="mono footer-chain">QORECHAIN-DIANA / 9800{address ? " / WALLET CONNECTED" : ""}</span></footer>
  </RainbowKitProvider>;
}
