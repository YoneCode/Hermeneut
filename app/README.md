# HERMENEUT frontend

React 18 + Vite + Tailwind UI for the HERMENEUT contract on GenLayer Bradbury.

```bash
npm install
cp .env.example .env     # set VITE_CONTRACT_ADDRESS, VITE_CHAIN, VITE_PRIVY_APP_ID
npm run build            # production build → dist
npm run preview          # serve the build
```

## Layout

- `src/logic/Hermeneut.js` — `genlayer-js` client wrapper over the contract's
  public methods (reads via `gen_call`, writes via the consensus contract).
- `src/services/chains.js` — GenLayer chain selection (`VITE_CHAIN`).
- `src/App.jsx` — register commitments, submit claims, browse the Recursive
  Precedent Graph, withdraw refunds.
- `src/components/` — precedent graph (static SVG), icons, logo.

Wallet auth uses [Privy](https://privy.io). Reads work without auth; writes
require a funded Bradbury account for gas.
