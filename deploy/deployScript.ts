/**
 * Stand-alone HERMENEUT deploy for live GenLayer testnets (Bradbury / Asimov).
 *
 * genlayer-js v0.9 hardcodes the V5 (5-arg) `addTransaction` ABI which
 * the live testnets reject — they ship V6 (6-arg, +`_validUntil`).
 * This script replicates what genlayer-cli does internally:
 *
 *   addTransaction(_sender, _recipient, _numOfInitialValidators,
 *                  _maxRotations, _txData, _validUntil)
 *
 * Reads:
 *   PRIVATE_KEY      (required)  — 0x-prefixed (or bare) 64-hex private key
 *   GENLAYER_CHAIN   (optional)  — bradbury (default) | asimov
 *   RPC_URL          (optional)  — overrides chain default
 *
 * Run:
 *   npx tsx deploy/deployScript.ts
 */
import "dotenv/config";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  createPublicClient,
  createWalletClient,
  http,
  encodeFunctionData,
  zeroAddress,
  type Hash,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { abi as glAbi } from "genlayer-js";

const ADD_TX_V6_ABI = [
  {
    type: "function",
    name: "addTransaction",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_sender",                 type: "address" },
      { name: "_recipient",              type: "address" },
      { name: "_numOfInitialValidators", type: "uint256" },
      { name: "_maxRotations",           type: "uint256" },
      { name: "_txData",                 type: "bytes"   },
      { name: "_validUntil",             type: "uint256" },
    ],
    outputs: [],
  },
] as const;

const NETWORKS = {
  bradbury: {
    id: 4221,
    rpc: "https://rpc-bradbury.genlayer.com",
    consensus: "0x0112Bf6e83497965A5fdD6Dad1E447a6E004271D" as `0x${string}`,
    explorer: "https://explorer-bradbury.genlayer.com",
  },
  asimov: {
    id: 4221,
    rpc: "https://rpc-asimov.genlayer.com",
    consensus: "0x0000000000000000000000000000000000000000" as `0x${string}`,
    explorer: "https://explorer-asimov.genlayer.com",
  },
};

function pickNet(name: string | undefined) {
  const k = (name || "bradbury").replace(/^testnet-/, "").toLowerCase();
  if (k in NETWORKS) return (NETWORKS as any)[k];
  return NETWORKS.bradbury;
}

function makeCalldataObject(
  method?: string,
  args?: any[],
  kwargs?: Record<string, any>,
) {
  const ret: Record<string, any> = {};
  if (method) ret.method = method;
  if (args && args.length > 0) ret.args = args;
  if (kwargs && Object.keys(kwargs).length > 0) ret.kwargs = kwargs;
  return ret;
}

async function genCall<T>(rpc: string, method: string, params: any[]): Promise<T> {
  const r = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || JSON.stringify(j.error));
  return j.result as T;
}

async function waitForGenReceipt(
  rpc: string,
  txHash: Hash,
  { retries = 240, intervalMs = 5000 } = {},
): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const r = await genCall<any>(rpc, "gen_getTransactionReceipt", [txHash]);
      if (r && r.consensus_data?.leader_receipt?.length) return r;
    } catch (_) { /* keep polling */ }
    await new Promise((res) => setTimeout(res, intervalMs));
  }
  throw new Error("Timed out waiting for gen_getTransactionReceipt");
}

async function main() {
  const raw = (process.env.PRIVATE_KEY || "").trim();
  if (!raw) throw new Error("PRIVATE_KEY missing in .env");
  const pk = (raw.startsWith("0x") || raw.startsWith("0X")
    ? raw : "0x" + raw) as `0x${string}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(pk))
    throw new Error("PRIVATE_KEY in .env is not a valid 64-hex string");

  const net = pickNet(process.env.GENLAYER_CHAIN);
  const rpcUrl = process.env.RPC_URL || net.rpc;
  const account = privateKeyToAccount(pk);

  console.log(`Network         : ${process.env.GENLAYER_CHAIN || "bradbury"}`);
  console.log(`RPC             : ${rpcUrl}`);
  console.log(`Consensus main  : ${net.consensus}`);
  console.log(`Deployer        : ${account.address}`);

  const here = path.dirname(fileURLToPath(import.meta.url));
  // Use the stripped contract source if present (saves ~30% bytes,
  // important for staying under Bradbury's calldata cap).
  const minimized = path.resolve(here, "..", "contracts", "hermeneut.min.py");
  const original = path.resolve(here, "..", "contracts", "hermeneut.py");
  let chosenPath = minimized;
  try { readFileSync(minimized); } catch { chosenPath = original; }
  console.log(`Source          : ${path.basename(chosenPath)}`);
  const codeBytes = readFileSync(chosenPath);
  const code = new Uint8Array(codeBytes);
  const calldataObj = makeCalldataObject(undefined, [], undefined);
  const calldataBytes: Uint8Array = (glAbi as any).calldata.encode(calldataObj);
  const innerSerialized: Uint8Array = (glAbi as any).transactions.serialize(
    [code, calldataBytes, /* leaderOnly */ false],
  );

  // ── Encode addTransaction(V6) ──────────────────────────────────────
  // _validUntil = 0  (treated as "no deadline" by the protocol)
  const txData =
    "0x" + Buffer.from(innerSerialized).toString("hex") as `0x${string}`;
  const encoded = encodeFunctionData({
    abi: ADD_TX_V6_ABI,
    functionName: "addTransaction",
    args: [
      account.address,
      zeroAddress,        // recipient = 0x0 → contract deployment
      5n,                 // _numOfInitialValidators
      3n,                 // _maxRotations
      txData,
      0n,                 // _validUntil (0 = none)
    ],
  });

  const chain = {
    id: net.id,
    name: "GenLayer Testnet",
    nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  } as const;

  const wallet = createWalletClient({ account, chain, transport: http(rpcUrl) });
  const pub = createPublicClient({ chain, transport: http(rpcUrl) });

  const nonce = await pub.getTransactionCount({ address: account.address });
  console.log(`Nonce           : ${nonce}`);

  // Pre-flight via eth_call so we get a clean revert reason if any.
  try {
    await pub.call({
      account: account.address,
      to: net.consensus,
      data: encoded,
    });
    console.log(`eth_call        : OK`);
  } catch (e: any) {
    console.error("eth_call simulation failed:", e?.shortMessage || e?.message || e);
    throw e;
  }

  const txHash = await wallet.sendTransaction({
    to: net.consensus,
    data: encoded,
    nonce,
    gas: 30_000_000n,           // generous; calldata is large
  });
  console.log(`\nDeployment tx   : ${txHash}`);
  console.log(`Explorer        : ${net.explorer}/tx/${txHash}`);
  console.log(`Polling gen_getTransactionReceipt …`);

  const receipt = await waitForGenReceipt(rpcUrl, txHash);
  const exec = receipt.consensus_data?.leader_receipt?.[0]?.execution_result;
  if (exec !== "SUCCESS") {
    console.error(JSON.stringify(receipt, null, 2));
    throw new Error(`Deployment leader_receipt result = ${exec}`);
  }
  const contractAddress = receipt.data?.contract_address || "(none)";
  console.log("\n✅ HERMENEUT deployed");
  console.log(JSON.stringify(
    { transactionHash: txHash, contractAddress }, null, 2,
  ));
}

main().catch((err) => {
  console.error(err?.shortMessage || err?.message || err);
  process.exit(1);
});
