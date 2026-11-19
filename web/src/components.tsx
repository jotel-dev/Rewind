import { useState, type ReactNode } from "react";
import { useAccount, useSendTransaction } from "wagmi";
import { type Hex, type TransactionReceipt } from "viem";
import { CONTRACT, publicClient, transactionUrl } from "./config.js";
import { InputError, safeError, states } from "./lib.js";

export function Icon({ name = "arrow", size = 18 }: { name?: string; size?: number }) {
  const shapes: Record<string, ReactNode> = {
    menu: <path d="M4 6h16M4 12h16M4 18h16" />, close: <path d="m6 6 12 12M18 6 6 18" />,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />, lock: <><rect x="5" y="10" width="14" height="11" rx="1" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>,
    moon: <path d="M20 14a8 8 0 0 1-10-10 8 8 0 1 0 10 10Z" />,
    code: <path d="m8 5-7 7 7 7m8-14 7 7-7 7m-3-16-2 18" />, plus: <path d="M12 5v14M5 12h14" />,
    shield: <><path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6Z" /><path d="m8 12 3 3 5-6" /></>,
    wallet: <><rect x="3" y="5" width="18" height="15" rx="1" /><path d="M3 9h18m-5 4h5m-4 3h1" /></>,
    check: <path d="m5 12 4 4L19 6" />, external: <><path d="M14 3h7v7m0-7L10 14" /><path d="M10 3H3v18h18v-7" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 6v6l4 2" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{shapes[name] ?? shapes.arrow}</svg>;
}
export function Badge({ state }: { state: number }) { return <span className={`badge state-${state}`}>{states[state] ?? "Unknown"}</span>; }
export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) { return <div className="notice" role={error ? "alert" : "status"}><Icon name="shield" /><div>{children}</div></div>; }
export function Empty({ title, children }: { title: string; children: ReactNode }) { return <div className="empty"><span className="empty-icon"><Icon name="wallet" size={26} /></span><h3>{title}</h3><div className="empty-copy">{children}</div></div>; }
export function ChainText({ children }: { children: ReactNode }) { return <code className="chain-text">{children}</code>; }

export function useTransaction() {
  const { address, chainId, connector } = useAccount();
  const send = useSendTransaction();
  const [stage, setStage] = useState<"idle" | "wallet" | "pending" | "confirmed" | "failed">("idle");
  const [hash, setHash] = useState<Hex>();
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<TransactionReceipt>();
  async function submit(data: Hex, value = 0n) {
    setError(""); setHash(undefined); setReceipt(undefined); setStage("wallet");
    try {
      if (!address || chainId !== 9800) throw new InputError("Connect a transaction-capable wallet on QoreChain testnet (9800).");
      if (await publicClient.getChainId() !== 9800) throw new InputError("The configured RPC is not QoreChain testnet (9800). Nothing was sent.");
      await publicClient.call({ account: address, to: CONTRACT, data, value });
      const tx = await send.sendTransactionAsync({ account: address, chainId: 9800, to: CONTRACT, data, value });
      setHash(tx); setStage("pending");
      const mined = await publicClient.waitForTransactionReceipt({ hash: tx, timeout: 120_000 });
      setReceipt(mined);
      if (mined.status !== "success") throw new InputError("The transaction reverted on-chain. Gas and window allowances may have been consumed.");
      setStage("confirmed");
      return mined;
    } catch (failure) { setStage("failed"); setError(safeError(failure)); }
  }
  const busy = stage === "wallet" || stage === "pending";
  const qorex = connector?.id.toLowerCase().includes("qorex") || connector?.name.toLowerCase().includes("qorex");
  return { submit, stage, hash, error, receipt, busy, qorex };
}
export function TransactionStatus({ tx }: { tx: ReturnType<typeof useTransaction> }) {
  if (tx.stage === "idle" && !tx.qorex) return null;
  return <div className="transaction-status" aria-live="polite">
    {tx.qorex && <p>The installed QoreX connector supports connection and reads. Use a transaction-capable injected wallet to send.</p>}
    {tx.stage !== "idle" && <p className="mono">{({ idle: "", wallet: "AWAITING WALLET APPROVAL", pending: "PENDING ON TESTNET", confirmed: "CONFIRMED ON TESTNET", failed: "TRANSACTION FAILED OR UNCONFIRMED" })[tx.stage]}</p>}
    {tx.hash && <a href={transactionUrl(tx.hash)} target="_blank" rel="noreferrer" className="hash-link">View transaction <Icon name="external" size={13} /><ChainText>{tx.hash}</ChainText></a>}
    {tx.receipt && <p>Gas used: <code>{tx.receipt.gasUsed.toString()}</code></p>}
    {tx.error && <p role="alert">{tx.error}</p>}
  </div>;
}
