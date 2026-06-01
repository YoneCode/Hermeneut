/**
 * HERMENEUT mark — a Recursive Precedent Graph glyph.
 * One root node branches to two children; each judgment cites prior
 * precedent. Built from squares + 1px edges to match the UI's grid
 * language. Pure geometry, off-blue on transparent.
 */
export default function Logo({ size = 32, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-label="Hermeneut"
      role="img"
    >
      {/* edges (drawn first, behind nodes) */}
      <path
        d="M9 9 L9 23 M9 16 L23 16 M23 16 L23 9 M23 16 L23 23"
        stroke="#d5e0ff"
        strokeWidth="1"
        strokeOpacity="0.55"
      />
      {/* root node (top-left) */}
      <rect x="5" y="5" width="8" height="8" fill="#d5e0ff" />
      {/* cited precedent (mid-right) */}
      <rect x="19" y="12" width="8" height="8" fill="#d5e0ff" fillOpacity="0.6" />
      {/* child judgments */}
      <rect x="5" y="19" width="8" height="8" fill="#d5e0ff" fillOpacity="0.6" />
      <rect x="19" y="24" width="6" height="6" fill="#d5e0ff" fillOpacity="0.35" />
    </svg>
  );
}
