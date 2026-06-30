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
| Contract | [`0x279C77384db0733165aC21D6D32DE2da986E5082`](https://explorer-bradbury.genlayer.com/address/0x279C77384db0733165aC21D6D32DE2da986E5082) |
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

Commitments registered on the live contract, plus one full resolution cycle
(register → claim → evaluate → precedent). Open them in the Bradbury explorer:

| Commitment | Domain | Register tx |
|---|---|---|
| `cmt_00000000` | ecosystem | [`0xa87bbac4…25b6210`](https://explorer-bradbury.genlayer.com/tx/0xa87bbac456e802cd949919bbfee804b955a0b5ac88fa6844a6a136ef425b6210) |
| `cmt_00000001` | dev-milestone | [`0xdc52ba13…9609cde`](https://explorer-bradbury.genlayer.com/tx/0xdc52ba1372f6fd6867163ae8957f0304088a71d1f0ac30574386830da9609cde) |
| `cmt_00000002` | grant-program | [`0xce5daeac…0b8c4e12`](https://explorer-bradbury.genlayer.com/tx/0xce5daeac5cee1d552b6c6570e851ab7c0b47885abb7262b868cae2dd0b8c4e12) |
| `cmt_00000003` | security-audit | [`0xef91b9ed…d24df7dbd`](https://explorer-bradbury.genlayer.com/tx/0xef91b9ed0298e233187ffdab5c5a25fe4148e3362df7491b8658686d24df7dbd) |
| `cmt_00000004` | governance | [`0xa5607a04…fda7dee3`](https://explorer-bradbury.genlayer.com/tx/0xa5607a040113a6270d87b80e60df12278912abbef6b07077717b66d7fda7dee3) |

Resolution of `cmt_00000000`: claim `clm_00000000` → `evaluate_claim`
([`0xad0b9a8d…420555a8`](https://explorer-bradbury.genlayer.com/tx/0xad0b9a8dea5f0feebf8fdd5bc3211eef3b6c811d302c35597d149921420555a8))
reached validator consensus (`unfulfilled`, 60% confidence) and wrote precedent
`prc_00000000` into the Recursive Precedent Graph.

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
VITE_CONTRACT_ADDRESS=0x279C77384db0733165aC21D6D32DE2da986E5082
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
