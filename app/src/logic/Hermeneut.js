import { createClient } from "genlayer-js";
import { pickChain } from "../services/chains.js";

function pick() {
  return pickChain(import.meta.env.VITE_CHAIN || "bradbury");
}

/**
 * Thin client wrapper around the HERMENEUT contract.
 *
 * Uses genlayer-js 1.1+ which routes reads through `gen_call` and writes
 * through the consensus contract automatically. Reads work without an
 * authenticated account (the SDK falls back to the zero address as the
 * `from` field).
 */
export default class Hermeneut {
  constructor(contractAddress, account = null) {
    this.contractAddress = contractAddress;
    this.account = account;
    this._buildClient();
  }

  _buildClient() {
    const chain = pick();
    this.client = createClient({
      chain,
      ...(this.account ? { account: this.account } : {}),
      ...(import.meta.env.VITE_RPC_URL
        ? { endpoint: import.meta.env.VITE_RPC_URL }
        : {}),
    });
  }

  updateAccount(account) {
    this.account = account;
    this._buildClient();
  }

  /* ------------------------------ Reads ------------------------------ */

  async _read(functionName, args = []) {
    // Bradbury rate-limits gen_call hard. Retry with longer backoff.
    let delay = 800;
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        return await this.client.readContract({
          address: this.contractAddress,
          functionName,
          args,
        });
      } catch (e) {
        const msg = (e?.shortMessage || e?.message || "").toLowerCase();
        if (attempt < 5 && msg.includes("rate limit")) {
          await new Promise((r) => setTimeout(r, delay));
          delay = Math.min(delay * 1.8, 6000);
          continue;
        }
        throw e;
      }
    }
  }

  getOwner() { return this._read("get_owner"); }
  isPaused() { return this._read("is_paused"); }

  async listActiveCommitments(limit = 25) {
    const r = await this._read("list_active_commitments", [limit]);
    return Array.isArray(r) ? r : [];
  }

  /**
   * Enumerate ALL commitments regardless of status. Ids are minted
   * contiguously, so we stop at the first GENUINELY empty slot.
   * Errors (e.g. transient rate limits) are NOT treated as a gap — they
   * propagate so the caller keeps prior data instead of showing a false
   * "no commitments". Small parallel batches keep RPC concurrency low.
   */
  async listAllCommitments(max = 64, batch = 4) {
    const out = [];
    for (let start = 0; start < max; start += batch) {
      const ids = [];
      for (let i = start; i < start + batch; i++) {
        ids.push(`cmt_${i.toString(16).padStart(8, "0")}`);
      }
      // No per-call catch: a rejected read (after _read's retries) throws
      // and aborts the whole refresh rather than masquerading as a gap.
      const res = await Promise.all(
        ids.map((id) => this._read("get_commitment", [id])),
      );
      let hitGap = false;
      for (const c of res) {
        if (c?.commitment_id) out.push(c);
        else { hitGap = true; break; }
      }
      if (hitGap) break;
    }
    return out;
  }
  async listRecentPrecedents(limit = 25) {
    const r = await this._read("list_recent_precedents", [limit]);
    return Array.isArray(r) ? r : [];
  }
  getCommitment(commitmentId) { return this._read("get_commitment", [commitmentId]); }
  getClaim(claimId)           { return this._read("get_claim", [claimId]); }
  getPrecedent(precedentId)   { return this._read("get_precedent", [precedentId]); }
  async getRefundOwed(addr)   { return Number(await this._read("get_refund_owed", [addr])) || 0; }
  async getTreasuryBalance()  { return Number(await this._read("get_treasury_balance")) || 0; }
  async getCitationFeesOwed(p){ return Number(await this._read("get_citation_fees_owed", [p])) || 0; }

  /* ------------------------------ Writes ----------------------------- */

  async _wait(txHash) {
    return this.client.waitForTransactionReceipt({
      hash: txHash,
      status: "ACCEPTED",
      retries: 200,
      interval: 5000,
    });
  }

  async _write(functionName, args = [], value = 0n) {
    const txHash = await this.client.writeContract({
      address: this.contractAddress,
      functionName,
      args,
      value: BigInt(value || 0n),
    });
    return this._wait(txHash);
  }

  async registerCommitment({
    beneficiary,
    condition,
    domainHint,
    ghostChain,
    ghostContractAddress,
    ghostAmountWei,
    ghostTokenAddress,
    ghostTimeoutBlockEvm,
    ttlBlocks,
    registrationFeeWei = 0n,
  }) {
    return this._write("register_commitment", [
      beneficiary,
      condition,
      domainHint,
      ghostChain,
      ghostContractAddress,
      BigInt(ghostAmountWei),
      ghostTokenAddress,
      BigInt(ghostTimeoutBlockEvm),
      BigInt(ttlBlocks),
    ], registrationFeeWei);
  }

  submitClaim({ commitmentId, evidenceText, evidenceUrls = [], stakeWei }) {
    return this._write("submit_claim", [commitmentId, evidenceText, evidenceUrls], stakeWei);
  }

  evaluateClaim(claimId)     { return this._write("evaluate_claim", [claimId]); }
  escalateClaim(claimId)     { return this._write("escalate_claim", [claimId]); }
  withdrawRefund()           { return this._write("withdraw_refund"); }
  withdrawCitationFees(pid)  { return this._write("withdraw_citation_fees", [pid]); }
  cancelCommitment(cid)      { return this._write("cancel_commitment", [cid]); }
}
