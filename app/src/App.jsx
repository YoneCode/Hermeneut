import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  usePrivy,
  useLogin,
  useWallets,
} from "@privy-io/react-auth";
import Hermeneut from "./logic/Hermeneut.js";
import Logo from "./components/Logo.jsx";
import { GitHubIcon, XIcon } from "./components/Icons.jsx";
import CommitmentGraph from "./components/CommitmentGraph.jsx";
import { NODE_COLOR } from "./components/nodeColors.js";

const CONTRACT = import.meta.env.VITE_CONTRACT_ADDRESS || "";
const CHAIN = (import.meta.env.VITE_CHAIN || "bradbury").replace(/^testnet-/, "");
const EXPLORER = "https://explorer-bradbury.genlayer.com";

// Registration transaction hashes for the 5 seeded commitments (Bradbury).
const REG_TX = {
  cmt_00000000: "0x54113145c7ba95cb0f47e09b6a1bfd95051e18296cdd2935de23ad0cb065ee43",
  cmt_00000001: "0x3751d7ff8e8bb780976b57606cc474d8a5819f6f30067b1609de735a794f87dc",
  cmt_00000002: "0x520e499074a7b9afd800e6a6659e7bf9d471ae25cdf5a13b789d96417bcf47e1",
  cmt_00000003: "0x90244f390eae7d8366fd9481c4f962b6ef8158de4a646081cae805c57a790893",
  cmt_00000004: "0x5d28f2d5f0c6d4ee423960fc31611ef44c7489e41ed6a8fa4f3a7caa381743eb",
};

const RAIL = [
  "GENLAYER INTELLIGENT CONTRACT",
  "LLM VALIDATOR CONSENSUS",
  "EQUIVALENCE PRINCIPLE",
  "RECURSIVE PRECEDENT GRAPH",
  "EVM GHOST CONTRACTS",
  "OPTIMISTIC DEMOCRACY",
];

function short(a) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
}

// Parse a human GEN amount (e.g. "1", "0.01", "2.5") to wei (BigInt string).
function genToWei(v) {
  const s = String(v ?? "").trim();
  if (!s || isNaN(Number(s))) return "0";
  const [whole, frac = ""] = s.split(".");
  const fracPadded = (frac + "0".repeat(18)).slice(0, 18);
  const wei = BigInt(whole || "0") * 10n ** 18n + BigInt(fracPadded || "0");
  return wei.toString();
}

// Format wei (number/string) back to a short GEN string for display.
function weiToGen(v) {
  try {
    const wei = BigInt(v || 0);
    const whole = wei / 10n ** 18n;
    const frac = (wei % 10n ** 18n)
      .toString().padStart(18, "0").slice(0, 4).replace(/0+$/, "");
    return frac ? `${whole}.${frac}` : `${whole}`;
  } catch {
    return "0";
  }
}

function Dots() {
  return (
    <span className="ht-btn-dots" aria-hidden>
      <i />
      <span />
    </span>
  );
}

function Box({ children, className = "" }) {
  return (
    <div className={`ht-box p-6 ${className}`}>
      <span className="ht-corner-bl" />
      <span className="ht-corner-br" />
      {children}
    </div>
  );
}

export default function App() {
  const { ready, authenticated, user, logout } = usePrivy();
  const { login } = useLogin();
  const { wallets } = useWallets();

  // Last-good snapshot cached in localStorage so the UI shows real data
  // instantly and survives Bradbury rate-limit storms.
  const CACHE_KEY = `hermeneut_cache_${CONTRACT}`;
  const cached = (() => {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); }
    catch { return null; }
  })();

  const [contract, setContract] = useState(null);
  const [commitments, setCommitments] = useState(cached?.commitments || []);
  const [precedents, setPrecedents] = useState(cached?.precedents || []);
  const [treasury, setTreasury] = useState(cached?.treasury || 0);
  const [refundOwed, setRefundOwed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [rail, setRail] = useState(0);
  const [loading, setLoading] = useState(!cached);
  const [showGuide, setShowGuide] = useState(
    () => localStorage.getItem("hermeneut_guide_seen") !== "1",
  );
  function dismissGuide() {
    localStorage.setItem("hermeneut_guide_seen", "1");
    setShowGuide(false);
  }

  const [reg, setReg] = useState({
    beneficiary: "",
    condition: "",
    domainHint: "general",
    ghostChain: "base",
    ghostContractAddress: "",
    ghostAmount: "1",
    ttlBlocks: 500,
  });
  const [cl, setCl] = useState({
    commitmentId: "",
    evidenceText: "",
    evidenceUrls: "",
    stake: "0.01",
  });

  const address = user?.wallet?.address || wallets?.[0]?.address || null;

  const notify = useCallback((m) => {
    setToast(m);
    setTimeout(() => setToast(""), 4500);
  }, []);

  // Build a Hermeneut client. For reads we never need a signer; for writes
  // we attach the Privy wallet's EIP-1193 provider as window.ethereum.
  const buildContract = useCallback(async () => {
    if (!CONTRACT) return null;
    const acct = address ? { address } : null;
    const h = new Hermeneut(CONTRACT, acct);
    // Wire the connected Privy wallet provider for signing.
    const w = wallets?.[0];
    if (w?.getEthereumProvider) {
      try {
        window.ethereum = await w.getEthereumProvider();
      } catch { /* ignore */ }
    }
    return h;
  }, [address, wallets]);

  const refreshing = useRef(false);
  const refresh = useCallback(async (h) => {
    const c = h || contract;
    if (!c || refreshing.current) return;
    refreshing.current = true;
    try {
      // Sequential to keep gen_call concurrency low (Bradbury rate-limits).
      // Commitments first (the primary content); only overwrite state on
      // success so a transient RPC failure never blanks the UI.
      const a = await c.listAllCommitments(64);
      let nextC = commitments, nextP = precedents, nextT = treasury;
      if (Array.isArray(a)) { setCommitments(a); nextC = a; }
      const p = await c.listRecentPrecedents(50);
      if (Array.isArray(p)) { setPrecedents(p); nextP = p; }
      const t = await c.getTreasuryBalance().catch(() => null);
      if (t !== null) { setTreasury(Number(t) || 0); nextT = Number(t) || 0; }
      if (address) {
        const r = await c.getRefundOwed(address).catch(() => null);
        if (r !== null) setRefundOwed(Number(r) || 0);
      }
      // Persist last-good snapshot.
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          commitments: nextC, precedents: nextP, treasury: nextT,
        }));
      } catch { /* quota / serialize issues are non-fatal */ }
    } catch (e) {
      notify("Refresh failed: " + (e?.shortMessage || e?.message || e));
    } finally {
      refreshing.current = false;
      setLoading(false);
    }
  }, [contract, address, notify]);

  useEffect(() => {
    (async () => {
      const h = await buildContract();
      setContract(h);
      if (h) refresh(h);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  useEffect(() => {
    const id = setInterval(() => setRail((r) => (r + 1) % RAIL.length), 2400);
    return () => clearInterval(id);
  }, []);

  const canRegister =
    contract && address && reg.beneficiary &&
    reg.condition.length >= 8 && reg.ghostContractAddress;
  const canClaim = contract && address && cl.commitmentId && cl.evidenceText;

  async function onRegister() {
    setBusy(true);
    try {
      await contract.registerCommitment({
        beneficiary: reg.beneficiary,
        condition: reg.condition,
        domainHint: reg.domainHint,
        ghostChain: reg.ghostChain,
        ghostContractAddress: reg.ghostContractAddress,
        ghostAmountWei: genToWei(reg.ghostAmount),
        ghostTokenAddress: "",
        ghostTimeoutBlockEvm: 0,
        ttlBlocks: reg.ttlBlocks,
      });
      notify("Commitment registered.");
      await refresh();
    } catch (e) {
      notify("Register failed: " + (e?.shortMessage || e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function onClaim() {
    setBusy(true);
    try {
      const urls = (cl.evidenceUrls || "")
        .split(",").map((s) => s.trim()).filter((s) => s.startsWith("http"));
      await contract.submitClaim({
        commitmentId: cl.commitmentId,
        evidenceText: cl.evidenceText,
        evidenceUrls: urls,
        stakeWei: genToWei(cl.stake),
      });
      notify("Claim submitted.");
      await refresh();
    } catch (e) {
      notify("Submit failed: " + (e?.shortMessage || e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function onEvaluate(claimId) {
    setBusy(true);
    try {
      await contract.evaluateClaim(claimId);
      notify("Claim evaluated.");
      await refresh();
    } catch (e) {
      notify("Evaluate failed: " + (e?.shortMessage || e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function onWithdraw() {
    setBusy(true);
    try {
      await contract.withdrawRefund();
      notify("Refund withdrawn.");
      await refresh();
    } catch (e) {
      notify("Withdraw failed: " + (e?.shortMessage || e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  const explorer = CONTRACT
    ? `https://explorer-bradbury.genlayer.com/address/${CONTRACT}`
    : null;

  return (
    <div className="min-h-screen bg-dark-blue text-off-blue">
      {/* Header */}
      <header className="border-b border-off-blue/10">
        <div className="max-w-[1400px] mx-auto px-8 md:px-12 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3 select-none">
            <Logo size={32} />
            <span className="ht-mono-label">HERMENEUT</span>
          </div>
          <div className="flex items-center gap-3">
            {/* DOCS · GITHUB · X · SIGN IN */}
            <a href="https://docs.genlayer.com" target="_blank" rel="noopener noreferrer"
               className="ht-btn" title="Built on GenLayer — read the docs">
              <Dots /><span className="hidden sm:inline">Built on GenLayer</span><span className="sm:hidden">Docs</span>
            </a>
            <a href="https://github.com/YoneCode/Hermeneut" target="_blank" rel="noopener noreferrer"
               className="opacity-60 hover:opacity-100 flex items-center p-2 -m-2" title="GitHub" aria-label="GitHub repository">
              <GitHubIcon size={18} />
            </a>
            <a href="https://x.com/YoneCode" target="_blank" rel="noopener noreferrer"
               className="opacity-60 hover:opacity-100 flex items-center p-2 -m-2" title="X" aria-label="X profile">
              <XIcon size={16} />
            </a>
            {ready && authenticated ? (
              <div className="ht-mono-label tracking-ht-16 flex items-center gap-3">
                <span className="opacity-50">WALLET</span>
                <span>{short(address)}</span>
                <button type="button" className="opacity-50 hover:opacity-100" onClick={logout}>
                  LOG OUT
                </button>
              </div>
            ) : (
              <button type="button" className="ht-btn ht-btn--solid" disabled={!ready} onClick={login}>
                <Dots />
                <span>{ready ? "Sign in" : "Loading…"}</span>
              </button>
            )}
            <button type="button"
              className="ht-mono-label tracking-ht-16 opacity-50 hover:opacity-100"
              title="How it works"
              onClick={() => setShowGuide(true)}>
              ?
            </button>
          </div>
        </div>
      </header>

      {/* First-visit guide (dismissable, remembered) */}
      {showGuide && (
        <section className="border-b border-off-blue/10 bg-off-blue/[0.03]">
          <div className="max-w-[1400px] mx-auto px-8 md:px-12 py-5">
            <div className="flex items-start justify-between gap-6">
              <div className="flex-1">
                <div className="ht-mono-label tracking-ht-16 opacity-60 mb-3">
                  HOW HERMENEUT WORKS
                </div>
                <ol className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    ["01", "REGISTER", "Escrow capital against a natural-language obligation — e.g. \u201cthe team ships v2 by Q3.\u201d"],
                    ["02", "CLAIM", "A beneficiary stakes GEN and submits evidence that the condition was met."],
                    ["03", "CONSENSUS", "LLM validators judge the claim against precedent; the verdict becomes new on-chain case law."],
                  ].map(([n, t, d]) => (
                    <li key={n} className="flex gap-3">
                      <span className="ht-tag h-fit">{n}</span>
                      <div>
                        <div className="ht-mono-label tracking-ht-16 mb-1">{t}</div>
                        <p className="text-ht-14 opacity-60">{d}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
              <button type="button"
                className="ht-mono-label tracking-ht-16 opacity-60 hover:opacity-100 shrink-0"
                onClick={dismissGuide}>
                GOT IT ✕
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Hero — headline far-left, precedent graph to its right */}
      <section className="max-w-[1400px] mx-auto px-8 md:px-12 pt-16 md:pt-24 pb-12 grid grid-cols-12 gap-8 items-center">
        <div className="col-span-12 lg:col-span-5">
          <span className="ht-tag mb-6 inline-flex">{CHAIN.toUpperCase()} · LIVE</span>
          <h1 className="ht-display text-ht-32 md:text-ht-56 mb-8">
            We govern<br />ambiguity through<br />recursive semantic<br />consensus.
          </h1>
          <p className="text-ht-14 md:text-ht-16 font-light max-w-[60ch] opacity-60 mb-8">
            Hermeneut escrows capital against natural-language obligations and resolves
            them through a stake-weighted, precedent-informed common-law engine on
            GenLayer Bradbury.
          </p>
          <div className="space-y-1 ht-mono-label tracking-ht-24">
            {RAIL.map((l, i) => (
              <div key={l} className="ht-rail-item" style={{ opacity: i === rail ? 1 : 0.5 }}>
                <span>{l}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-7">
          <Box>
            <div className="flex justify-between items-center mb-4">
              <h2 className="ht-mono-label tracking-ht-16 opacity-60">05 · RECURSIVE PRECEDENT GRAPH</h2>
              <span className="ht-mono-label tracking-ht-16 opacity-40">
                {String(commitments.length).padStart(2, "0")} COMMITMENTS · {String(precedents.length).padStart(2, "0")} PRECEDENTS
              </span>
            </div>

            {/* Static SVG graph of real on-chain state. */}
            <CommitmentGraph
              commitments={commitments}
              precedents={precedents}
              onPick={(c) => setCl((s) => ({ ...s, commitmentId: c.commitment_id }))}
            />

            <div className="ht-mono-label tracking-ht-8 opacity-40 mt-2 flex flex-wrap gap-x-5 gap-y-1">
              <span><span className="inline-block size-2 align-middle mr-1" style={{ background: NODE_COLOR.active }} /> COMMITMENT</span>
              <span><span className="inline-block size-2 align-middle mr-1" style={{ background: NODE_COLOR.fulfilled }} /> FULFILLED</span>
              <span><span className="inline-block size-2 align-middle mr-1" style={{ background: NODE_COLOR.unfulfilled }} /> UNFULFILLED</span>
              <span><span className="inline-block size-2 align-middle mr-1" style={{ background: NODE_COLOR.precedent }} /> PRECEDENT</span>
              <span>HOVER FOR DETAIL · CLICK A COMMITMENT TO STAGE A CLAIM</span>
            </div>

            {precedents.length === 0 && (
              <div className="ht-mono-label opacity-40 mt-3 text-center">
                PRECEDENT NODES APPEAR AS CLAIMS ARE EVALUATED BY VALIDATOR CONSENSUS
              </div>
            )}
          </Box>
        </div>
      </section>

      {/* Stat strip */}
      <section className="border-y border-off-blue/10">
        <div className="max-w-[1400px] mx-auto px-8 md:px-12 py-10 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            ["COMMITMENTS", String(commitments.length).padStart(2, "0"), ""],
            ["PRECEDENTS", String(precedents.length).padStart(2, "0"), ""],
            ["TREASURY", weiToGen(treasury), "GEN"],
            ["REFUND OWED", weiToGen(refundOwed), "GEN"],
          ].map(([label, value, unit]) => (
            <div className="ht-row" key={label}>
              <div className="ht-mono-label tracking-ht-16 opacity-60 mb-3">{label}</div>
              {loading && commitments.length === 0 ? (
                <div className="text-ht-32 ht-display opacity-40 ht-pulse">··</div>
              ) : (
                <div className="text-ht-32 ht-display ht-tick" key={value}>{value}</div>
              )}
              {unit && <div className="ht-mono-label tracking-ht-16 mt-2 opacity-40">{unit}</div>}
            </div>
          ))}
        </div>
      </section>

      {/* Working area */}
      <section className="max-w-[1400px] mx-auto px-8 md:px-12 py-12 grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-5 space-y-8">
          {ready && !authenticated && (
            <div className="ht-box ht-box--ghost px-4 py-3 flex items-center justify-between gap-4">
              <span className="ht-corner-bl" />
              <span className="ht-corner-br" />
              <span className="ht-mono-label tracking-ht-16 opacity-70">
                SIGN IN TO REGISTER OR CLAIM
              </span>
              <button type="button" className="ht-btn ht-btn--solid" onClick={login}>
                <Dots /><span>Sign in</span>
              </button>
            </div>
          )}
          <Box>
            <h2 className="ht-mono-label tracking-ht-16 opacity-60 mb-4">01 · REGISTER A COMMITMENT</h2>
            <h3 className="ht-display text-ht-32 mb-6">Bind capital<br />to language.</h3>
            <div className="space-y-2">
              <input className="ht-input" placeholder="BENEFICIARY 0x…" aria-label="Beneficiary address"
                value={reg.beneficiary} onChange={(e) => setReg({ ...reg, beneficiary: e.target.value })} />
              <textarea className="ht-input" rows={3} placeholder="NATURAL-LANGUAGE CONDITION (≥ 8 CHARS)" aria-label="Natural-language condition"
                value={reg.condition} onChange={(e) => setReg({ ...reg, condition: e.target.value })} />
              <input className="ht-input" placeholder="DOMAIN HINT" aria-label="Domain hint"
                value={reg.domainHint} onChange={(e) => setReg({ ...reg, domainHint: e.target.value })} />
              <input className="ht-input" placeholder="EVM GHOST CONTRACT 0x…" aria-label="EVM ghost contract address"
                value={reg.ghostContractAddress} onChange={(e) => setReg({ ...reg, ghostContractAddress: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <input className="ht-input" placeholder="EVM CHAIN" aria-label="EVM chain"
                  value={reg.ghostChain} onChange={(e) => setReg({ ...reg, ghostChain: e.target.value })} />
                <input className="ht-input" type="number" placeholder="TTL BLOCKS" aria-label="Time-to-live in blocks"
                  value={reg.ttlBlocks} onChange={(e) => setReg({ ...reg, ttlBlocks: Number(e.target.value) })} />
              </div>
              <input className="ht-input" placeholder="LOCKED AMOUNT (GEN)" aria-label="Locked amount in GEN"
                value={reg.ghostAmount} onChange={(e) => setReg({ ...reg, ghostAmount: e.target.value })} />
              <div className="pt-2">
                <button type="button" className="ht-btn ht-btn--solid" disabled={busy || !canRegister} onClick={onRegister}>
                  <Dots /><span>{busy ? "Submitting…" : "Register commitment"}</span>
                </button>
              </div>
            </div>
          </Box>

          <Box>
            <h2 className="ht-mono-label tracking-ht-16 opacity-60 mb-4">02 · SUBMIT A CLAIM</h2>
            <h3 className="ht-display text-ht-32 mb-6">Stake your<br />evidence.</h3>
            <div className="space-y-2">
              <input className="ht-input" placeholder="COMMITMENT ID (CMT_…)" aria-label="Commitment ID"
                value={cl.commitmentId} onChange={(e) => setCl({ ...cl, commitmentId: e.target.value })} />
              <textarea className="ht-input" rows={3} placeholder="EVIDENCE TEXT" aria-label="Evidence text"
                value={cl.evidenceText} onChange={(e) => setCl({ ...cl, evidenceText: e.target.value })} />
              <input className="ht-input" placeholder="EVIDENCE URLS (COMMA-SEPARATED)" aria-label="Evidence URLs, comma-separated"
                value={cl.evidenceUrls} onChange={(e) => setCl({ ...cl, evidenceUrls: e.target.value })} />
              <input className="ht-input" placeholder="STAKE (GEN)" aria-label="Stake in GEN"
                value={cl.stake} onChange={(e) => setCl({ ...cl, stake: e.target.value })} />
              <div className="pt-2">
                <button type="button" className="ht-btn ht-btn--solid" disabled={busy || !canClaim} onClick={onClaim}>
                  <Dots /><span>{busy ? "Submitting…" : "Submit claim"}</span>
                </button>
              </div>
            </div>
          </Box>

          <Box>
            <h2 className="ht-mono-label tracking-ht-16 opacity-60 mb-4">03 · REFUNDS</h2>
            <div className="flex items-end justify-between">
              <div>
                <div className="ht-display text-ht-40">{weiToGen(refundOwed)}</div>
                <div className="ht-mono-label tracking-ht-16 opacity-60 mt-1">GEN OWED</div>
              </div>
              <button type="button" className="ht-btn" disabled={busy || !address || refundOwed <= 0} onClick={onWithdraw}>
                <Dots /><span>Withdraw</span>
              </button>
            </div>
          </Box>
        </div>

        <div className="col-span-12 lg:col-span-7 space-y-8">
          <Box>
            <div className="flex justify-between items-center mb-4">
              <h2 className="ht-mono-label tracking-ht-16 opacity-60">04 · COMMITMENTS</h2>
              <button type="button" className="ht-mono-label tracking-ht-16 opacity-60 hover:opacity-100"
                onClick={() => { setLoading(true); refresh(); }}>↻ REFRESH</button>
            </div>
            {loading && commitments.length === 0 && (
              <div className="py-8">
                <div className="ht-loading mb-4" />
                <div className="ht-mono-label tracking-ht-16 opacity-40 text-center ht-pulse">
                  READING ON-CHAIN STATE FROM BRADBURY…
                </div>
              </div>
            )}
            {!loading && commitments.length === 0 ? (
              <div className="py-8 text-center">
                <div className="ht-mono-label tracking-ht-16 opacity-60 mb-2">NO COMMITMENTS YET</div>
                <p className="text-ht-14 opacity-40 max-w-[40ch] mx-auto">
                  Registered commitments appear here. Use “01 · Register a commitment”
                  to escrow capital against a natural-language obligation.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {commitments.map((c, i) => (
                  <div className="ht-row ht-enter" style={{ "--i": i }} key={c.commitment_id}>
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <code className="ht-mono-label tracking-ht-16">{c.commitment_id}</code>
                      <span className="ht-tag">{(c.domain_hint || "general").toUpperCase()} · {(c.status || "").toUpperCase()}</span>
                    </div>
                    <p className="text-ht-14 mb-3">{c.condition}</p>
                    <div className="ht-mono-label tracking-ht-8 opacity-60 flex flex-wrap gap-x-5 gap-y-1">
                      <span>CREATOR {short(c.creator)}</span>
                      <span>BENEFICIARY {short(c.beneficiary)}</span>
                      <span>COHERENCE {(c.coherence_score_bps / 100).toFixed(1)}%</span>
                      <span>LOCKED {weiToGen(c.ghost?.amount_wei)} GEN · {(c.ghost?.chain || "").toUpperCase()}</span>
                    </div>
                    <div className="mt-3 flex items-center gap-5">
                      {c.active_claim_id && (
                        <button type="button" className="ht-mono-label tracking-ht-16 underline underline-offset-2 opacity-80 hover:opacity-100"
                          onClick={() => onEvaluate(c.active_claim_id)}>
                          ↳ EVALUATE ACTIVE CLAIM
                        </button>
                      )}
                      {REG_TX[c.commitment_id] && (
                        <a className="ht-mono-label tracking-ht-16 underline underline-offset-2 opacity-60 hover:opacity-100"
                          href={`${EXPLORER}/tx/${REG_TX[c.commitment_id]}`}
                          target="_blank" rel="noopener noreferrer">
                          VIEW TX →
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Box>
        </div>
      </section>

      <footer className="sticky bottom-0 z-10 border-t border-off-blue/10 bg-dark-blue/80 backdrop-blur">
        <div className="max-w-[1400px] mx-auto px-8 md:px-12 py-4 flex items-center justify-between">
          <span className="ht-mono-label tracking-ht-16 opacity-50">
            {short(CONTRACT)} · {CHAIN.toUpperCase()} · CHAIN 4221
          </span>
          {explorer && (
            <a href={explorer} target="_blank" rel="noopener noreferrer"
              className="ht-mono-label tracking-ht-16 opacity-70 hover:opacity-100">
              VIEW ON EXPLORER →
            </a>
          )}
        </div>
      </footer>

      {toast && (
        <output aria-live="polite"
          className="ht-toast fixed bottom-20 right-6 ht-box ht-box--ghost px-4 py-2 ht-mono-label tracking-ht-16 z-50">
          <span className="ht-corner-bl" />
          <span className="ht-corner-br" />
          {toast}
        </output>
      )}
    </div>
  );
}
