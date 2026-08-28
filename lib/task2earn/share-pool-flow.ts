/**
 * Pure Share Rewards pool integration rules. No RPC, database, or signatures.
 */

import {
  getAddress,
  isAddress,
  type Address,
  type Hex,
} from "viem";
import type { T2eRewardLedgerRow } from "./db";
import { SHARE_CAST_MAX_AGE_MS, SHARE_CAST_REWARD_BQR } from "./constants";
import { normalizeCastHash } from "./verification-logic";

export const SHARE_POOL_PAYOUT_BQR = SHARE_CAST_REWARD_BQR;
export const SHARE_POOL_PAYOUT_WEI = 25n * 10n ** 18n;

export function walletsMatch(
  connected: string | null | undefined,
  qualified: string | null | undefined,
): boolean {
  if (!connected || !qualified) {
    return false;
  }
  if (!isAddress(connected, { strict: false }) || !isAddress(qualified, { strict: false })) {
    return false;
  }
  return getAddress(connected) === getAddress(qualified);
}

export function isStandalonePendingRow(row: {
  reward_type?: string;
  status?: string;
  tx_hash?: string | null;
}): boolean {
  return (
    row.reward_type === "bqr_share_daily" &&
    row.status === "pending" &&
    !row.tx_hash
  );
}

export function isStandalonePaidRow(row: {
  reward_type?: string;
  status?: string;
}): boolean {
  return row.reward_type === "bqr_share_daily" && row.status === "credited";
}

export function isStandaloneActivityRow(row: {
  reward_type?: string;
  status?: string;
}): boolean {
  return (
    row.reward_type === "bqr_share_daily" &&
    (row.status === "pending" || row.status === "credited")
  );
}

export type ClaimReceiptView = {
  status: "success" | "reverted";
  account: Address;
  fid: bigint;
  castHash: Hex;
  amountWei: bigint;
  txHash: string;
};

export type LedgerPaidDecision =
  | {
      ok: true;
      markPaid: true;
      status: "credited";
      txHash: string;
      amountBqr: number;
    }
  | { ok: true; markPaid: false; alreadyPaid: true; txHash: string }
  | {
      ok: false;
      markPaid: false;
      error:
        | "receipt_reverted"
        | "wrong_wallet"
        | "amount_mismatch"
        | "no_pending_row"
        | "already_paid";
    };

export function decideLedgerAfterClaimReceipt(params: {
  connectedWallet: string;
  qualifiedWallet: string;
  pending: Pick<
    T2eRewardLedgerRow,
    "status" | "tx_hash" | "wallet_address" | "amount_bqr" | "reward_type"
  > | null;
  receipt: ClaimReceiptView | null;
}): LedgerPaidDecision {
  if (!params.receipt || params.receipt.status !== "success") {
    return { ok: false, markPaid: false, error: "receipt_reverted" };
  }
  if (!walletsMatch(params.connectedWallet, params.qualifiedWallet)) {
    return { ok: false, markPaid: false, error: "wrong_wallet" };
  }
  if (!walletsMatch(params.connectedWallet, params.receipt.account)) {
    return { ok: false, markPaid: false, error: "wrong_wallet" };
  }
  if (params.receipt.amountWei !== SHARE_POOL_PAYOUT_WEI) {
    return { ok: false, markPaid: false, error: "amount_mismatch" };
  }
  if (
    params.pending &&
    isStandalonePaidRow(params.pending) &&
    params.pending.tx_hash === params.receipt.txHash
  ) {
    return {
      ok: true,
      markPaid: false,
      alreadyPaid: true,
      txHash: params.receipt.txHash,
    };
  }
  if (params.pending && isStandalonePaidRow(params.pending)) {
    return { ok: false, markPaid: false, error: "already_paid" };
  }
  if (!params.pending || !isStandalonePendingRow(params.pending)) {
    return { ok: false, markPaid: false, error: "no_pending_row" };
  }
  if (!walletsMatch(params.connectedWallet, params.pending.wallet_address)) {
    return { ok: false, markPaid: false, error: "wrong_wallet" };
  }
  return {
    ok: true,
    markPaid: true,
    status: "credited",
    txHash: params.receipt.txHash,
    amountBqr: SHARE_POOL_PAYOUT_BQR,
  };
}

export function fidCooldownActive(
  lastClaimAtMs: number | null,
  nowMs: number,
  windowMs = SHARE_CAST_MAX_AGE_MS,
): boolean {
  if (!lastClaimAtMs) {
    return false;
  }
  return nowMs < lastClaimAtMs + windowMs;
}

export function sameClaimReplay(
  usedClaimKeys: ReadonlySet<string>,
  claimKey: string,
): boolean {
  return usedClaimKeys.has(claimKey);
}

export function sharePoolClaimKey(params: {
  account: string;
  fid: number;
  castHash: string;
}): string {
  return `${getAddress(params.account)}:${params.fid}:${normalizeCastHash(params.castHash)}`;
}
