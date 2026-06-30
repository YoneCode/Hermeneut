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
    // Bradbury's gas estimator under-shoots value-bearing / non-deterministic
    // writes (submit_claim, evaluate_claim): the internal genvm sub-call runs
    // out of gas and the EVM tx reverts. Force a high fixed gas limit so the
    // consensus contract always has enough headroom. Reads (gen_call) are
    // unaffected — they don't estimate gas.
    this.client.estimateTransactionGas = async () => 12_000_000n;
  }

  updateAccount(account) {
    this.account = account;
    this._buildClient();
  }

  /* ------------------------------ Reads ------------------------------ */

  async _read(functionName, args = []) {
    // Bradbury rate-limits gen_call hard (JSON-RPC code -32005). Retry with
    // exponential backoff; matches both the message and the error code.
    let delay = 700;
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        return await this.client.readContract({
          address: this.contractAddress,
          functionName,
          args,
        });
      } catch (e) {
        const msg = (e?.shortMessage || e?.message || "").toLowerCase();
        const limited =
          msg.includes("rate limit") ||
          msg.includes("-32005") ||
          msg.includes("exceeded");
        if (attempt < 7 && limited) {
          await new Promise((r) => setTimeout(r, delay));
          delay = Math.min(delay * 1.7, 8000);
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
   * Reads run STRICTLY SEQUENTIALLY with a small gap between calls — Bradbury
   * rate-limits gen_call per method, so any concurrency trips -32005. Errors
   * (after _read's retries) propagate so the caller keeps prior data instead
   * of showing a false "no commitments".
   */
  async listAllCommitments(max = 64) {
    const out = [];
    for (let i = 0; i < max; i++) {
      const id = `cmt_${i.toString(16).padStart(8, "0")}`;
      const c = await this._read("get_commitment", [id]);
      if (!c?.commitment_id) break; // genuine empty slot → end of list
      out.push(c);
      await new Promise((r) => setTimeout(r, 250)); // stay under the rate limit
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
