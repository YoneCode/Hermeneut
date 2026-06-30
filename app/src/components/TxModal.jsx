import { useEffect, useRef } from "react";

const EXPLORER = "https://explorer-bradbury.genlayer.com";

function short(h) {
  return h ? `${h.slice(0, 10)}\u2026${h.slice(-8)}` : "";
}

const STEPS = [
  { key: "sign", label: "Sign", hint: "Approve in your wallet" },
  { key: "broadcast", label: "Broadcast", hint: "Sent to GenLayer" },
  { key: "consensus", label: "Consensus", hint: "Validators reach a verdict" },
];

// phase -> how far the stepper has progressed
const REACHED = {
  signing: 0,
  confirming: 1, // broadcast done, consensus running
  success: 3,
  error: -1,
};

/**
 * Centered, focus-trapped transaction modal. Renders the live lifecycle of a
 * write: awaiting signature, broadcasting, reaching consensus, confirmed or
 * failed. Shows the tx hash with an explorer link as soon as it exists.
 */
export default function TxModal({ tx, onClose }) {
  const closeRef = useRef(null);
  const open = !!tx?.open;
  const phase = tx?.phase || "signing";
  const done = phase === "success";
  const failed = phase === "error";
  const reached = REACHED[phase] ?? 0;
  const dismissable = done || failed;

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape" && dismissable) onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, dismissable, onClose]);

  if (!open) return null;

  return (
    <div className="ht-modal" role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget && dismissable) onClose(); }}>
      <div className="ht-modal__panel ht-box" role="dialog" aria-modal="true"
        aria-label={`${tx.title} transaction`}>
        <span className="ht-corner-bl" /><span className="ht-corner-br" />

        <div className="ht-modal__head">
          <span className="ht-mono-label ht-dim">Transaction</span>
          <h2 className="ht-h3">{tx.title}</h2>
        </div>

        {/* status icon */}
        <div className={`ht-txstate ht-txstate--${failed ? "err" : done ? "ok" : "run"}`}>
          {done ? (
            <svg viewBox="0 0 48 48" aria-hidden><path className="ht-tick-path" d="M14 25l7 7 14-15" fill="none" stroke="currentColor" strokeWidth="3" /></svg>
          ) : failed ? (
            <svg viewBox="0 0 48 48" aria-hidden><path d="M16 16l16 16M32 16L16 32" fill="none" stroke="currentColor" strokeWidth="3" /></svg>
          ) : (
            <span className="ht-spinner" aria-hidden />
          )}
        </div>

        {/* stepper */}
        {!failed && (
          <ol className="ht-steps2" aria-hidden>
            {STEPS.map((s, i) => (
              <li key={s.key}
                className={"ht-step2" + (reached > i ? " is-done" : reached === i ? " is-active" : "")}>
                <span className="ht-step2__dot" />
                <span className="ht-step2__label">{s.label}</span>
                <span className="ht-step2__hint ht-dim">{s.hint}</span>
              </li>
            ))}
          </ol>
        )}

        <p className={"ht-modal__msg" + (failed ? " ht-modal__msg--err" : "")}>{tx.message}</p>

        {tx.hash && (
          <a className="ht-modal__hash ht-mono-label" href={`${EXPLORER}/tx/${tx.hash}`}
            target="_blank" rel="noopener noreferrer">
            {short(tx.hash)} <span aria-hidden>↗</span>
          </a>
        )}

        <div className="ht-modal__actions">
          {dismissable ? (
            <button type="button" ref={closeRef} className="ht-btn ht-btn--solid" onClick={onClose}>
              <span>{done ? "Done" : "Close"}</span>
            </button>
          ) : (
            <span className="ht-mono-label ht-dim ht-modal__wait">Keep this open while the network settles</span>
          )}
        </div>
      </div>
    </div>
  );
}
