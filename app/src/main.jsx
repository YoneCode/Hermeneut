import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import "./style.css";

// Silence genlayer-js's own console.error noise for conditions our client
// already handles (rate-limit retries, simulator-only consensus init).
const _origError = console.error;
console.error = (...a) => {
  const s = typeof a[0] === "string" ? a[0] : "";
  if (s.includes("rate limit exceeded") ||
      s.includes("Failed to initialize consensus smart contract") ||
      s.includes("GenLayer RPC error")) return;
  _origError.apply(console, a);
};

// Heavy chunk: Privy SDK + App. Loads after the lightweight shell paints.
const Root = lazy(() => import("./Root.jsx"));

// Tiny branded boot screen (stays in the main chunk; paints instantly).
function Boot() {
  return (
    <div className="min-h-screen bg-dark-blue text-off-blue flex items-center justify-center">
      <div className="w-64">
        <div className="flex items-center gap-3 justify-center mb-6 select-none">
          <span className="block size-8 bg-off-blue" />
          <span className="ht-mono-label">HERMENEUT</span>
        </div>
        <div className="ht-loading mb-3" />
        <div className="ht-mono-label tracking-ht-16 opacity-60 text-center ht-pulse">
          INITIALIZING
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Suspense fallback={<Boot />}>
      <Root />
    </Suspense>
  </React.StrictMode>,
);
