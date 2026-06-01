# HERMENEUT — tests

`test_hermeneut.py` is a [gltest](https://docs.genlayer.com) integration suite
for `contracts/hermeneut.py`. It requires a running GenLayer network.

```bash
pip install -r ../requirements.txt

# Option A — local network
genlayer init        # one-time
genlayer up          # leave running

# Option B — studionet
genlayer network set studionet

pytest test_hermeneut.py -v
```

## Coverage

- Deployment + owner / pause / treasury views.
- Commitment registration happy-path and greybox rejection of invalid input.
- Claim flow: register → submit_claim → evaluate_claim → a precedent appears
  in the RPG.
- Withdrawal guards: `withdraw_refund` errors when nothing is owed; non-owners
  cannot drain the treasury.
- Governance: pause blocks writes; only the owner may pause.

LLM-driven branches (coherence check, claim verdicts) are non-deterministic by
design. The suite asserts on transaction success and on the **presence** of
state mutations, not on specific LLM verdicts.
