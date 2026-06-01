"""
Integration tests for the HERMENEUT contract.

Run against a live GenLayer environment:

    # localnet (recommended for fast iteration)
    genlayer init
    genlayer up
    pytest test/test_hermeneut.py -v

    # studionet
    genlayer network set studionet
    pytest test/test_hermeneut.py -v

These tests exercise the *deterministic* paths of the contract
(register / submit / view / withdraw / pause / governance). The
LLM-driven paths (coherence_check, evaluate_claim) are kept lightweight
and rely on the network's default validators returning *some* valid
response. If you want strict assertions on LLM outcomes, configure
mock validators via gltest's ValidatorFactory in a conftest.
"""
from __future__ import annotations

from pathlib import Path

import pytest

from gltest import (
    get_contract_factory,
    get_default_account,
    create_accounts,
)
from gltest.assertions import tx_execution_succeeded


CONTRACT_PATH = (
    Path(__file__).resolve().parents[1] / "contracts" / "hermeneut.py"
)


# --------------------------------------------------------------------------
# Fixtures
# --------------------------------------------------------------------------

@pytest.fixture(scope="module")
def deployed():
    """Deploy a fresh Hermeneut contract once per test module."""
    factory = get_contract_factory(contract_file_path=str(CONTRACT_PATH))
    contract = factory.deploy(args=[])
    yield contract


@pytest.fixture(scope="module")
def alt_accounts():
    """Spin up two extra accounts for cross-actor tests."""
    return create_accounts(2)


# --------------------------------------------------------------------------
# Basic deployment / views
# --------------------------------------------------------------------------

def test_owner_is_deployer(deployed):
    owner = deployed.get_owner.call()
    assert owner.lower() == get_default_account().address.lower()


def test_initially_unpaused(deployed):
    assert deployed.is_paused.call() is False


def test_treasury_initially_zero(deployed):
    assert int(deployed.get_treasury_balance.call()) == 0


def test_no_recent_precedents_initially(deployed):
    out = deployed.list_recent_precedents.call(args=[10])
    assert isinstance(out, list)
    assert len(out) == 0


# --------------------------------------------------------------------------
# Commitment registration
# --------------------------------------------------------------------------

def test_register_commitment_basic(deployed, alt_accounts):
    """Happy-path registration of a coherent commitment."""
    beneficiary = alt_accounts[0].address
    receipt = deployed.register_commitment.transact(
        args=[
            beneficiary,
            "The development team will publish a transparency report and "
            "open-source the governance contract within 90 days.",
            "dev-milestone",
            "base",
            "0x000000000000000000000000000000000000aBCD",
            10**18,                       # 1 ETH-equivalent in the ghost
            "",                            # native ETH
            10_000_000,
            500,                           # ttl_blocks
        ],
        value=0,                           # registration_fee = 0 since
                                            # coherent commitment
    )
    assert tx_execution_succeeded(receipt)


def test_register_commitment_rejects_short_condition(deployed, alt_accounts):
    """Greybox: condition < 8 chars must be rejected."""
    with pytest.raises(Exception):
        deployed.register_commitment.transact(
            args=[
                alt_accounts[0].address,
                "go",                       # too short
                "general",
                "base",
                "0x000000000000000000000000000000000000aBCD",
                10**17,
                "",
                10_000_000,
                100,
            ],
        )


# --------------------------------------------------------------------------
# Claim flow
# --------------------------------------------------------------------------

def test_full_claim_flow(deployed, alt_accounts):
    """Register -> submit_claim -> evaluate_claim -> precedent appears."""
    beneficiary_acct = alt_accounts[0]
    deployed.register_commitment.transact(
        args=[
            beneficiary_acct.address,
            "The DAO will distribute Q2 grant funds to at least three "
            "independent contributor teams.",
            "grant-program",
            "base",
            "0x000000000000000000000000000000000000aBCD",
            10**18,
            "",
            10_000_000,
            500,
        ],
        value=0,
    )

    # Find the most recent commitment id by listing actives.
    actives = deployed.list_active_commitments.call(args=[10])
    assert len(actives) > 0
    cid = actives[0]["commitment_id"]

    # Submit a fulfillment claim with a small stake.
    claim_receipt = deployed.submit_claim.transact(
        args=[
            cid,
            "Three independent teams (Aleph, Beacon, Cohort) received "
            "grants of $50k each on May 25, 2026; tx hashes published "
            "in the DAO's transparency log.",
            ["https://example.com/q2-grants-report"],
        ],
        value=10_000_000_000_000_000,    # 0.01 ETH stake
        account=beneficiary_acct,
    )
    assert tx_execution_succeeded(claim_receipt)

    # Run the evaluation. Don't assert a specific conclusion here — the
    # LLM may legitimately go either way; just check the tx succeeds and
    # a precedent gets minted.
    eval_receipt = deployed.evaluate_claim.transact(
        args=[
            # Newest claim id can be derived from the commitment record.
            deployed.get_commitment.call(args=[cid])["active_claim_id"]
            or deployed.get_commitment.call(args=[cid])["claims"][-1]
        ],
        wait_interval=10_000,
        wait_retries=20,
    )
    assert tx_execution_succeeded(eval_receipt)

    precs = deployed.list_recent_precedents.call(args=[5])
    assert isinstance(precs, list)
    assert len(precs) >= 1
    assert precs[0]["precedent_id"].startswith("prc_")


# --------------------------------------------------------------------------
# Withdrawals
# --------------------------------------------------------------------------

def test_withdraw_refund_errors_when_nothing_owed(deployed):
    with pytest.raises(Exception):
        deployed.withdraw_refund.transact(args=[])


def test_treasury_withdraw_only_owner(deployed, alt_accounts):
    """A non-owner must not be able to drain the treasury."""
    with pytest.raises(Exception):
        deployed.withdraw_treasury.transact(
            args=[1, alt_accounts[1].address],
            account=alt_accounts[1],
        )


# --------------------------------------------------------------------------
# Pause / governance
# --------------------------------------------------------------------------

def test_pause_blocks_writes(deployed, alt_accounts):
    deployed.set_paused.transact(args=[True])
    try:
        with pytest.raises(Exception):
            deployed.register_commitment.transact(
                args=[
                    alt_accounts[0].address,
                    "any reasonable condition",
                    "general",
                    "base",
                    "0x000000000000000000000000000000000000aBCD",
                    10**17,
                    "",
                    10_000_000,
                    100,
                ],
            )
    finally:
        deployed.set_paused.transact(args=[False])
    assert deployed.is_paused.call() is False


def test_set_paused_only_owner(deployed, alt_accounts):
    with pytest.raises(Exception):
        deployed.set_paused.transact(
            args=[True], account=alt_accounts[1],
        )
