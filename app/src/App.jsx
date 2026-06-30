import { useEffect, useState, useCallback, useRef } from "react";
import { usePrivy, useLogin, useWallets } from "@privy-io/react-auth";
import Hermeneut from "./logic/Hermeneut.js";
import Nav from "./components/Nav.jsx";
import HowItWorks from "./components/HowItWorks.jsx";
import Features from "./components/Features.jsx";
import Faq from "./components/Faq.jsx";
import SiteFooter from "./components/SiteFooter.jsx";
import CommitmentGraph from "./components/CommitmentGraph.jsx";
import { NODE_COLOR } from "./components/nodeColors.js";

const CONTRACT = import.meta.env.VITE_CONTRACT_ADDRESS || "";
const CHAIN = (import.meta.env.VITE_CHAIN || "bradbury").replace(/^testnet-/, "");
const EXPLORER = "https://explorer-bradbury.genlayer.com";

// Registration transaction hashes for the seeded commitments (Bradbury).
const REG_TX = {
  cmt_00000000: "0xa87bbac456e802cd949919bbfee804b955a0b5ac88fa6844a6a136ef425b6210",
  cmt_00000001: "0xdc52ba1372f6fd6867163ae8957f0304088a71d1f0ac30574386830da9609cde",
  cmt_00000002: "0xce5daeac5cee1d552b6c6570e851ab7c0b47885abb7262b868cae2dd0b8c4e12",
  cmt_00000003: "0xef91b9ed0298e233187ffdab5c5a25fe4148e3362df7491b8658686d24df7dbd",
  cmt_00000004: "0xa5607a040113a6270d87b80e60df12278912abbef6b07077717b66d7fda7dee3",
};

function short(a) {
  return a ? `${a.slice(0, 6)}\u2026${a.slice(-4)}` : "";
}

function genToWei(v) {
  const s = String(v ?? "").trim();
  if (!s || Number.isNaN(Number(s))) return "0";
  const [whole, frac = ""] = s.split(".");
  const fracPadded = (frac + "0".repeat(18)).slice(0, 18);
  return (BigInt(whole || "0") * 10n ** 18n + BigInt(fracPadded || "0")).toString();
}

function weiToGen(v) {
  try {
    const wei = BigInt(v || 0);
    const whole = wei / 10n ** 18n;
    const frac = (wei % 10n ** 18n).toString().padStart(18, "0").slice(0, 4).replace(/0+$/, "");
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
  const [loading, setLoading] = useState(!cached);

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

  const buildContract = useCallback(async () => {
    if (!CONTRACT) return null;
    // Obtain the Privy wallet's EIP-1193 provider for signing, and make sure
    // it is on GenLayer Bradbury (chain 4221) so writes are signed + sent on
    // the right network. genlayer-js routes signing to this provider only when
    // the account is passed as a STRING address.
    let provider = null;
    const w = wallets?.[0];
    if (w) {
      try { await w.switchChain(4221); } catch { /* embedded wallet may already be on it */ }
      try { provider = await w.getEthereumProvider(); } catch { /* ignore */ }
    }
    return new Hermeneut(CONTRACT, address || null, provider);
  }, [address, wallets]);

  const refreshing = useRef(false);
  const refresh = useCallback(async (h) => {
    const c = h || contract;
    if (!c || refreshing.current) return;
    refreshing.current = true;
    try {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contract, address, notify]);

  useEffect(() => {
    (async () => {
      const h = await buildContract();
      setContract(h);
      if (h) refresh(h);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

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
      notify("Evaluation submitted. Validators are reaching consensus.");
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

  const explorer = CONTRACT ? `${EXPLORER}/address/${CONTRACT}` : null;
  const nC = String(commitments.length).padStart(2, "0");
  const nP = String(precedents.length).padStart(2, "0");

  return (
    <div className="ht-app" id="top">
      <Nav ready={ready} authenticated={authenticated} address={address} login={login} logout={logout} />

      {/* HERO — asymmetric: argument on the left, live graph on the right */}
      <section className="ht-hero">
        <div className="ht-hero__copy">
          <span className="ht-tag ht-hero__pill">{CHAIN.toUpperCase()} testnet · live</span>
          <h1 className="ht-display ht-h1">
            Capital, bound to language.
          </h1>
          <p className="ht-lead ht-hero__lead">
            HERMENEUT escrows funds against obligations written in plain English,
            then settles them with a network of LLM validators that judge each
            claim against everything they have ruled before.
          </p>
          <div className="ht-hero__cta">
            <a href="#protocol" className="ht-btn ht-btn--solid"><Dots /><span>Launch the app</span></a>
            <a href="#how" className="ht-btn"><Dots /><span>See how it works</span></a>
          </div>
          <div className="ht-hero__ticker ht-mono-label">
            <span><b>{nC}</b> commitments</span>
            <span><b>{nP}</b> precedents</span>
            <span><b>{weiToGen(treasury)}</b> GEN escrowed</span>
          </div>
        </div>

        <div className="ht-hero__visual">
          <Box>
            <div className="ht-rowhead">
              <h2 className="ht-mono-label">Recursive precedent graph</h2>
              <span className="ht-mono-label ht-dim">{nC} commitments · {nP} precedents</span>
            </div>
            <CommitmentGraph
              commitments={commitments}
              precedents={precedents}
              onPick={(c) => setCl((s) => ({ ...s, commitmentId: c.commitment_id }))}
            />
            <div className="ht-legend ht-mono-label">
              <span><i style={{ background: NODE_COLOR.active }} /> commitment</span>
              <span><i style={{ background: NODE_COLOR.fulfilled }} /> fulfilled</span>
              <span><i style={{ background: NODE_COLOR.unfulfilled }} /> unfulfilled</span>
              <span><i style={{ background: NODE_COLOR.precedent }} /> precedent</span>
            </div>
          </Box>
        </div>
      </section>

      <HowItWorks />
      <Features />

      {/* LIVE PROTOCOL — the working dApp */}
      <section id="protocol" className="ht-section">
        <div className="ht-section__head">
          <h2 className="ht-display ht-h2">Interact with the live protocol.</h2>
          <p className="ht-lead">
            Real transactions on GenLayer Bradbury. Reads are free; registering,
            claiming, and evaluating need a funded wallet.
          </p>
        </div>

        <div className="ht-stats">
          {[
            ["Commitments", nC, ""],
            ["Precedents", nP, ""],
            ["Treasury", weiToGen(treasury), "GEN"],
            ["Refund owed", weiToGen(refundOwed), "GEN"],
          ].map(([label, value, unit]) => (
            <div className="ht-stat" key={label}>
              <div className="ht-mono-label ht-dim">{label}</div>
              {loading && commitments.length === 0 ? (
                <div className="ht-display ht-stat__v ht-pulse">··</div>
              ) : (
                <div className="ht-display ht-stat__v ht-tick" key={value}>
                  {value}{unit && <span className="ht-stat__u"> {unit}</span>}
                </div>
              )}
            </div>
          ))}
        </div>

        {ready && !authenticated && (
          <div className="ht-signin ht-box">
            <span className="ht-corner-bl" /><span className="ht-corner-br" />
            <span className="ht-mono-label">Sign in to register, claim, or evaluate</span>
            <button type="button" className="ht-btn ht-btn--solid" onClick={login}>
              <Dots /><span>Sign in</span>
            </button>
          </div>
        )}

        <div className="ht-protocol">
          <div className="ht-protocol__forms">
            <Box>
              <h3 className="ht-h3">Register a commitment</h3>
              <p className="ht-form-hint">Escrow GEN against an obligation in plain language.</p>
              <div className="ht-fields">
                <input className="ht-input" placeholder="Beneficiary address (0x…)" aria-label="Beneficiary address"
                  value={reg.beneficiary} onChange={(e) => setReg({ ...reg, beneficiary: e.target.value })} />
                <textarea className="ht-input" rows={3} placeholder="Natural-language condition (at least 8 characters)" aria-label="Natural-language condition"
                  value={reg.condition} onChange={(e) => setReg({ ...reg, condition: e.target.value })} />
                <input className="ht-input" placeholder="Domain hint (e.g. dev-milestone)" aria-label="Domain hint"
                  value={reg.domainHint} onChange={(e) => setReg({ ...reg, domainHint: e.target.value })} />
                <input className="ht-input" placeholder="EVM ghost contract (0x…)" aria-label="EVM ghost contract address"
                  value={reg.ghostContractAddress} onChange={(e) => setReg({ ...reg, ghostContractAddress: e.target.value })} />
                <div className="ht-fields__row">
                  <input className="ht-input" placeholder="EVM chain" aria-label="EVM chain"
                    value={reg.ghostChain} onChange={(e) => setReg({ ...reg, ghostChain: e.target.value })} />
                  <input className="ht-input" type="number" placeholder="TTL blocks" aria-label="Time-to-live in blocks"
                    value={reg.ttlBlocks} onChange={(e) => setReg({ ...reg, ttlBlocks: Number(e.target.value) })} />
                </div>
                <input className="ht-input" placeholder="Locked amount (GEN)" aria-label="Locked amount in GEN"
                  value={reg.ghostAmount} onChange={(e) => setReg({ ...reg, ghostAmount: e.target.value })} />
                <button type="button" className="ht-btn ht-btn--solid" disabled={busy || !canRegister} onClick={onRegister}>
                  <Dots /><span>{busy ? "Submitting" : "Register commitment"}</span>
                </button>
              </div>
            </Box>

            <Box>
              <h3 className="ht-h3">Submit a claim</h3>
              <p className="ht-form-hint">Stake GEN and argue the condition was met.</p>
              <div className="ht-fields">
                <input className="ht-input" placeholder="Commitment id (cmt_…)" aria-label="Commitment ID"
                  value={cl.commitmentId} onChange={(e) => setCl({ ...cl, commitmentId: e.target.value })} />
                <textarea className="ht-input" rows={3} placeholder="Evidence text" aria-label="Evidence text"
                  value={cl.evidenceText} onChange={(e) => setCl({ ...cl, evidenceText: e.target.value })} />
                <input className="ht-input" placeholder="Evidence URLs (comma-separated)" aria-label="Evidence URLs, comma-separated"
                  value={cl.evidenceUrls} onChange={(e) => setCl({ ...cl, evidenceUrls: e.target.value })} />
                <input className="ht-input" placeholder="Stake (GEN)" aria-label="Stake in GEN"
                  value={cl.stake} onChange={(e) => setCl({ ...cl, stake: e.target.value })} />
                <button type="button" className="ht-btn ht-btn--solid" disabled={busy || !canClaim} onClick={onClaim}>
                  <Dots /><span>{busy ? "Submitting" : "Submit claim"}</span>
                </button>
              </div>
            </Box>

            <Box>
              <h3 className="ht-h3">Refunds</h3>
              <div className="ht-refund">
                <div>
                  <div className="ht-display ht-refund__v">{weiToGen(refundOwed)}</div>
                  <div className="ht-mono-label ht-dim">GEN owed</div>
                </div>
                <button type="button" className="ht-btn" disabled={busy || !address || refundOwed <= 0} onClick={onWithdraw}>
                  <Dots /><span>Withdraw refund</span>
                </button>
              </div>
            </Box>
          </div>

          <div className="ht-protocol__list">
            <Box>
              <div className="ht-rowhead">
                <h3 className="ht-h3">Commitments</h3>
                <button type="button" className="ht-mono-label ht-refresh"
                  onClick={() => { setLoading(true); refresh(); }}>↻ Refresh</button>
              </div>

              {loading && commitments.length === 0 && (
                <div className="ht-empty">
                  <div className="ht-loading" />
                  <div className="ht-mono-label ht-dim ht-pulse">Reading on-chain state from Bradbury</div>
                </div>
              )}

              {!loading && commitments.length === 0 ? (
                <div className="ht-empty">
                  <div className="ht-mono-label">No commitments yet</div>
                  <p className="ht-dim">Register one above to escrow capital against an obligation.</p>
                </div>
              ) : (
                <div className="ht-clist">
                  {commitments.map((c, i) => (
                    <article className="ht-row ht-enter" style={{ "--i": i }} key={c.commitment_id}>
                      <div className="ht-row__top">
                        <code className="ht-mono-label">{c.commitment_id}</code>
                        <span className="ht-tag">{(c.domain_hint || "general").toUpperCase()} · {(c.status || "").toUpperCase()}</span>
                      </div>
                      <p className="ht-row__cond">{c.condition}</p>
                      <div className="ht-row__meta ht-mono-label ht-dim">
                        <span>creator {short(c.creator)}</span>
                        <span>beneficiary {short(c.beneficiary)}</span>
                        <span>coherence {(c.coherence_score_bps / 100).toFixed(1)}%</span>
                        <span>locked {weiToGen(c.ghost?.amount_wei)} GEN · {(c.ghost?.chain || "").toUpperCase()}</span>
                      </div>
                      <div className="ht-row__actions">
                        {c.active_claim_id && (
                          <button type="button" className="ht-link" onClick={() => onEvaluate(c.active_claim_id)}>
                            Evaluate active claim →
                          </button>
                        )}
                        {REG_TX[c.commitment_id] && (
                          <a className="ht-link ht-dim" href={`${EXPLORER}/tx/${REG_TX[c.commitment_id]}`}
                            target="_blank" rel="noopener noreferrer">View tx →</a>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </Box>
          </div>
        </div>
      </section>

      <Faq />
      <SiteFooter contract={CONTRACT} chain={CHAIN} explorer={explorer} />

      {toast && (
        <output aria-live="polite" className="ht-toast ht-box">
          <span className="ht-corner-bl" /><span className="ht-corner-br" />
          {toast}
        </output>
      )}
    </div>
  );
}
