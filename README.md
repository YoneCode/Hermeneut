# HERMENEUT

> Recursive Semantic Jurisprudence Engine on GenLayer

HERMENEUT is a GenLayer intelligent contract that escrows capital against
**natural-language obligations** and resolves them through **LLM-validator
consensus**. Every resolved claim is written into a **Recursive Precedent
Graph (RPG)** — a stare-decisis-style body of on-chain case law that
informs how future claims are interpreted.

A commitment is a sentence ("the team ships v2 by Q3", "the grantee made
good-faith progress toward decentralization"). A beneficiary stakes GEN and
submits evidence. Validators judge the claim against the relevant precedent,
and the verdict itself becomes precedent.

**Live on GenLayer Bradbury testnet**

| | |
|---|---|
| Contract | [`0x274837A29Cc71E1CD3304d2D7aB3BC08168473AE`](https://explorer-bradbury.genlayer.com/address/0x274837A29Cc71E1CD3304d2D7aB3BC08168473AE) |
| Chain | GenLayer Bradbury (chain id `4221`) |
| Explorer | https://explorer-bradbury.genlayer.com |
| Frontend | React 18 + Vite, deployed on Cloudflare Pages |

---

## How it works

```
        register_commitment            submit_claim            evaluate_claim
 creator ───────────────▶ commitment ───────────────▶ claim ───────────────▶ verdict
 (escrow + NL condition)             (stake + evidence)        (LLM consensus)   │
                                                                                 ▼
                                                          Recursive Precedent Graph
                                                          (nodes + weighted citation
                                                           edges + landmark precedents)
                                                                                 │
                                                          informs future evaluations ◀┘
```

1. **Register** — a creator escrows value and binds it to a sanitized
   natural-language condition. Registration runs a coherence check that
   rejects paradoxical or self-contradictory text.
2. **Claim** — a beneficiary stakes GEN (`MIN_CLAIM_STAKE` = 0.01 GEN) and
   submits evidence text plus optional source URLs.
3. **Evaluate** — one consensus round judges the claim. Low-stake disputes
   use `gl.eq_principle.prompt_comparative`; high-stake disputes (level ≥ 2)
   use `gl.vm.run_nondet_unsafe` behind a strict programmatic gate. The
   verdict creates a new RPG node and links it to the precedents it cited.

---

## Example on-chain transactions

Five commitments registered on the live contract (open in the Bradbury explorer):

| Commitment | Domain | Tx |
|---|---|---|
| `cmt_00000000` | dev-milestone | [`0x54113145…65ee43`](https://explorer-bradbury.genlayer.com/tx/0x54113145c7ba95cb0f47e09b6a1bfd95051e18296cdd2935de23ad0cb065ee43) |
| `cmt_00000001` | grant-program | [`0x3751d7ff…4f87dc`](https://explorer-bradbury.genlayer.com/tx/0x3751d7ff8e8bb780976b57606cc474d8a5819f6f30067b1609de735a794f87dc) |
| `cmt_00000002` | security-audit | [`0x520e4990…bcf47e1`](https://explorer-bradbury.genlayer.com/tx/0x520e499074a7b9afd800e6a6659e7bf9d471ae25cdf5a13b789d96417bcf47e1) |
| `cmt_00000003` | defi-risk | [`0x90244f39…a790893`](https://explorer-bradbury.genlayer.com/tx/0x90244f390eae7d8366fd9481c4f962b6ef8158de4a646081cae805c57a790893) |
| `cmt_00000004` | governance | [`0x5d28f2d5…1743eb`](https://explorer-bradbury.genlayer.com/tx/0x5d28f2d5f0c6d4ee423960fc31611ef44c7489e41ed6a8fa4f3a7caa381743eb) |

---

## Project layout

```
hermeneut/
├── contracts/
│   ├── hermeneut.py        # GenLayer intelligent contract (source of truth)
│   └── hermeneut.min.py    # docstring-stripped build (fits Bradbury calldata cap)
├── deploy/
│   └── deployScript.ts     # deploys hermeneut.min.py to Bradbury
├── test/
│   ├── test_hermeneut.py   # gltest integration suite
│   └── conftest.py
├── app/                    # React + Vite frontend
│   ├── src/
│   │   ├── App.jsx
│   │   ├── logic/Hermeneut.js      # genlayer-js client wrapper
│   │   ├── services/chains.js
│   │   └── components/
│   ├── public/
│   └── package.json
├── strip_contract.py       # AST docstring stripper (.py → .min.py)
└── requirements.txt
```

---

## Contract surface

Selected public methods (full set in `contracts/hermeneut.py`):

| Method | Kind | Description |
|---|---|---|
| `register_commitment` | write · payable | Bind escrow to a natural-language condition. Sanitizes input and runs an LLM coherence check. |
| `submit_claim` | write · payable | Stake GEN and submit fulfillment evidence (text + URLs). |
| `evaluate_claim` | write | One consensus round; writes an RPG node and emits a settlement signal. |
| `escalate_claim` | write | Raise the dispute level (0→3); higher levels use larger validator sets and stricter thresholds. |
| `cancel_commitment` | write | Creator cancels a commitment before any claim. |
| `withdraw_refund` | write | Pull accumulated refund credit. |
| `withdraw_citation_fees` | write | Pull citation fees accrued by a precedent you originated. |
| `get_commitment` / `get_claim` / `get_precedent` | view | State readers. |
| `list_active_commitments` / `list_recent_precedents` | view | Indexed enumerations. |
| `get_treasury_balance` / `get_refund_owed` / `get_owner` / `is_paused` | view | Auxiliary readers. |

### Prompt-injection resilience

Every user-supplied string passes through a greybox sanitizer before it
reaches an LLM: Unicode normalization, zero-width/non-printable stripping,
regex neutralization of injection patterns, and length truncation. Inside
the prompt the sanitized text is fenced between delimiters and the system
prompt treats it strictly as data. Precedent text is re-sanitized on every
retrieval so the RPG cannot become an injection-amplification vector.

---

## Develop

### Contract

```bash
pip install -r requirements.txt
pytest test/test_hermeneut.py -v
```

### Frontend

```bash
cd app
npm install
cp .env.example .env          # fill in the values below
npm run build                 # production build → app/dist
npm run preview               # serve the build locally
```

`app/.env`:

```
VITE_CONTRACT_ADDRESS=0x274837A29Cc71E1CD3304d2D7aB3BC08168473AE
VITE_CHAIN=bradbury
VITE_PRIVY_APP_ID=<your-privy-app-id>
```

Wallet auth uses [Privy](https://privy.io). Contract reads work without auth;
writes require a funded Bradbury account for gas.

---

## Deploy the contract

The contract is deployed from the docstring-stripped build, which keeps the
payload under Bradbury's calldata cap:

```bash
npm install
python3 strip_contract.py     # contracts/hermeneut.py → contracts/hermeneut.min.py
PRIVATE_KEY=0x… npx tsx deploy/deployScript.ts
```

`PRIVATE_KEY` is read from the environment (or a local `.env`) and is never
committed. Fund the deployer address from the
[Bradbury faucet](https://genlayer.com/faucet) first.

---

## Deploy the frontend (Cloudflare Pages)

The frontend is a static Vite build. On Cloudflare Pages, connect the
repository and use:

| Setting | Value |
|---|---|
| Root directory | `app` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Environment variables | `VITE_CONTRACT_ADDRESS`, `VITE_CHAIN`, `VITE_PRIVY_APP_ID` |

`app/public/_redirects` provides the single-page fallback. Vite 5 requires
Node 18 or newer (set `NODE_VERSION=20` in the Pages environment if needed).

---

## Stack

- **Contract** — GenLayer Python intelligent contract (`gl.eq_principle`,
  `gl.vm.run_nondet_unsafe`, on-chain LLM consensus).
- **Frontend** — React 18, Vite 5, Tailwind CSS, `genlayer-js`, Privy auth.
- **Network** — GenLayer Bradbury testnet (chain id 4221).

## Links

- Repository — https://github.com/YoneCode/Hermeneut
- Author — https://x.com/YoneCode
- GenLayer docs — https://docs.genlayer.com

## License

MIT — see [`LICENSE`](LICENSE).
