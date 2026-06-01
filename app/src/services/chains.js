/**
 * Chain selector for genlayer-js >= 1.1. Uses the SDK's built-in chain
 * configs directly (testnetBradbury, testnetAsimov, studionet, localnet).
 */
import { chains } from "genlayer-js";

export function pickChain(name) {
  const k = (name || "bradbury").replace(/^testnet-/, "").toLowerCase();
  switch (k) {
    case "asimov":
      return chains.testnetAsimov;
    case "studionet":
      return chains.studionet;
    case "localnet":
      return chains.localnet;
    default:
      return chains.testnetBradbury;
  }
}
