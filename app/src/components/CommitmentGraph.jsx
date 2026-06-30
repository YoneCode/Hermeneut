import { useRef, useState } from "react";
import { NODE_COLOR } from "./nodeColors.js";

/**
 * Recursive Precedent Graph — STATIC SVG bubble map.
 * Deterministic radial layout (no canvas, no rAF, no timing — cannot blank).
 * Bubbles sized by value; hovering one shows an info box and dims the rest.
 */

const VW = 800;
const VH = 360;

const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");
const genOf = (wei) => Number(BigInt(wei || 0) / 10n ** 15n) / 1000;
const statusColor = (s) => NODE_COLOR[s] || NODE_COLOR.void;

export default function CommitmentGraph({ commitments = [], precedents = [], onPick }) {
  const wrapRef = useRef(null);
  const [hover, setHover] = useState(null);     // hovered node
  const [pos, setPos] = useState({ x: 0, y: 0, flip: false, flipY: false });

  const cx = VW / 2, cy = VH / 2;

  // Root.
  const root = { id: "__root__", kind: "root", x: cx, y: cy, r: 16 };

  // Inner ring: commitments (bubble radius ∝ √locked GEN).
  const cNodes = commitments.map((c, i) => {
    const ang = -Math.PI / 2 + (i / Math.max(commitments.length, 1)) * Math.PI * 2;
    const gen = genOf(c.ghost?.amount_wei);
    return {
      id: c.commitment_id, kind: "commitment", data: c,
      x: cx + Math.cos(ang) * 120, y: cy + Math.sin(ang) * 120,
      r: 13 + Math.min(20, Math.sqrt(Math.max(gen, 0.1)) * 6),
      color: statusColor(c.status),
    };
  });
  const byCommit = new Map(cNodes.map((n) => [n.id, n]));

  // Outer ring: precedents, linked to their source commitment.
  const pNodes = precedents.map((p, i) => {
    const ang = -Math.PI / 2 + (i / Math.max(precedents.length, 1)) * Math.PI * 2 + 0.4;
    return {
      id: p.precedent_id, kind: "precedent", data: p,
      x: cx + Math.cos(ang) * 168, y: cy + Math.sin(ang) * 168,
      r: 8 + Math.min(12, Number(p.citation_count || 0) * 2),
      color: p.landmark ? NODE_COLOR.landmark : NODE_COLOR.precedent,
      parent: byCommit.get(p.commitment_id) || root,
    };
  });

  const edges = [
    ...cNodes.map((n) => [root, n]),
    ...pNodes.map((n) => [n.parent, n]),
  ];

  // Neighborhood highlight: when hovering, keep the node + its links lit.
  const active = (id) => {
    if (!hover) return true;
    if (hover.id === id) return true;
    if (hover.kind === "root") return true;
    // commitment hovered → its precedents + root stay lit
    if (hover.kind === "commitment") {
      if (id === "__root__") return true;
      const p = pNodes.find((n) => n.id === id);
      return p ? p.parent.id === hover.id : false;
    }
    // precedent hovered → its parent commitment + root stay lit
    if (hover.kind === "precedent") {
      return id === hover.parent.id || id === "__root__";
    }
    return false;
  };
  const edgeLit = (a, b) => !hover || (active(a.id) && active(b.id));

  function onMove(e) {
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return;
    const x = e.clientX - r.left, y = e.clientY - r.top;
    setPos({ x, y, flip: x > r.width * 0.6, flipY: y > r.height * 0.55 });
  }

  return (
    <div
      ref={wrapRef}
      className="relative w-full"
      style={{ height: VH }}
      onMouseMove={onMove}
      onMouseLeave={() => setHover(null)}
    >
      <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" height={VH}
        role="img" style={{ display: "block" }}
        aria-label={`Recursive precedent graph: ${commitments.length} commitments and ${precedents.length} precedents. The commitments list below is the accessible equivalent.`}
      >
        {/* edges */}
        {edges.map(([a, b], i) => (
          <line key={`e${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke="#d5e0ff" strokeWidth="1"
            strokeOpacity={edgeLit(a, b) ? 0.3 : 0.05} />
        ))}

        {/* precedent bubbles */}
        {pNodes.map((n) => (
          <circle key={n.id} cx={n.x} cy={n.y} r={n.r}
            fill={n.color} fillOpacity={active(n.id) ? 0.85 : 0.18}
            stroke={hover?.id === n.id ? n.color : "none"} strokeWidth="2"
            style={{ cursor: "default", transition: "fill-opacity .15s" }}
            onMouseEnter={() => setHover(n)} />
        ))}

        {/* commitment bubbles (clickable) */}
        {cNodes.map((n) => (
          <g key={n.id} onMouseEnter={() => setHover(n)}
            onClick={() => onPick && onPick(n.data)}
            style={{ cursor: onPick ? "pointer" : "default" }}>
            <circle cx={n.x} cy={n.y} r={n.r}
              fill={n.color} fillOpacity={active(n.id) ? 1 : 0.2}
              stroke={hover?.id === n.id ? "#ffffff" : "none"} strokeWidth="2"
              style={{ transition: "fill-opacity .15s" }} />
            <text x={n.x} y={n.y + n.r + 13} textAnchor="middle"
              fill="#d5e0ff" fillOpacity={active(n.id) ? 0.7 : 0.15}
              fontFamily="'JetBrains Mono', monospace" fontSize="10" letterSpacing="1">
              {n.id}
            </text>
          </g>
        ))}

        {/* root */}
        <circle cx={cx} cy={cy} r={root.r} fill={NODE_COLOR.root}
          fillOpacity={active("__root__") ? 1 : 0.25}
          onMouseEnter={() => setHover(root)} style={{ cursor: "default" }} />
        <text x={cx} y={cy + root.r + 14} textAnchor="middle" fill="#d5e0ff"
          fillOpacity="0.7" fontFamily="'JetBrains Mono', monospace"
          fontSize="10" letterSpacing="2">HERMENEUT</text>
      </svg>

      {/* hover info box */}
      {hover && (
        <div
          className="pointer-events-none absolute ht-box ht-box--ghost px-3 py-2 max-w-[280px] z-20"
          style={{
            left: pos.x + 14,
            top: pos.y + 14,
            transform: `${pos.flip ? "translateX(-100%) translateX(-28px)" : ""} ${pos.flipY ? "translateY(-100%) translateY(-28px)" : ""}`.trim() || "none",
          }}
        >
          <span className="ht-corner-bl" />
          <span className="ht-corner-br" />
          {hover.kind === "commitment" && (
            <>
              <div className="ht-mono-label tracking-ht-16 mb-1">{hover.id}</div>
              <p className="text-ht-14 mb-2">{hover.data.condition}</p>
              <div className="ht-mono-label tracking-ht-8 opacity-60 flex flex-wrap gap-x-4 gap-y-1">
                <span>{(hover.data.domain_hint || "").toUpperCase()}</span>
                <span>{(hover.data.status || "").toUpperCase()}</span>
                <span>LOCKED {genOf(hover.data.ghost?.amount_wei)} GEN</span>
                <span>BENEFICIARY {short(hover.data.beneficiary)}</span>
              </div>
            </>
          )}
          {hover.kind === "precedent" && (
            <>
              <div className="ht-mono-label tracking-ht-16 mb-1">{hover.id}</div>
              <div className="ht-mono-label tracking-ht-8 opacity-60 flex flex-wrap gap-x-4 gap-y-1">
                <span>{(hover.data.conclusion || "").toUpperCase()}</span>
                <span>{(hover.data.confidence_bps / 100).toFixed(0)}% CONFIDENCE</span>
                <span>{hover.data.citation_count} CITATIONS</span>
                {hover.data.landmark && <span className="text-amber-300">★ LANDMARK</span>}
              </div>
            </>
          )}
          {hover.kind === "root" && (
            <>
              <div className="ht-mono-label tracking-ht-16 mb-1">HERMENEUT</div>
              <div className="ht-mono-label tracking-ht-8 opacity-60">
                RECURSIVE PRECEDENT GRAPH · {commitments.length} COMMITMENTS · {precedents.length} PRECEDENTS
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
