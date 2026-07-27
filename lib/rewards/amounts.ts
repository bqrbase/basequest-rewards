import { parseUnits } from "viem";

/** Default BQR decimals when on-chain read is unavailable. */
export const DEFAULT_BQR_DECIMALS = 18;

/**
 * Convert whole-token catalog amounts to base units (wei).
 * Catalog amounts are integers; fractional BQR is rejected.
 */
export function bqrToWei(amountBqr: number, decimals = DEFAULT_BQR_DECIMALS): bigint {
  if (!Number.isFinite(amountBqr) || amountBqr < 0) {
    throw new Error("bqrToWei: amountBqr must be a non-negative finite number");
  }
  if (!Number.isInteger(amountBqr)) {
    throw new Error("bqrToWei: amountBqr must be a whole-token integer");
  }
  return parseUnits(String(amountBqr), decimals);
}

export function weiToString(amountWei: bigint): string {
  return amountWei.toString();
}
