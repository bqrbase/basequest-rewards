/**
 * Pure Share Cast reward rules. Database and Neynar I/O live in share-reward.ts.
 */

import {
  SHARE_CAST_REWARD_BQR,
  SHARE_CAST_REWARD_TYPE,
} from "./constants";
import type { T2eRewardLedgerRow } from "./db";
import type {
  ShareCastRewardEntry,
  Task2EarnTask,
  TaskStatus,
} from "./types";
import {
  isValidWalletAddress,
  normalizeWalletAddress,
} from "../x/config";

export const SHARE_CAST_ELIGIBLE_STATUSES: readonly TaskStatus[] = [
  "draft",
  "open",
  "active",
];

export type ShareCastEligibilityError =
  | "task_not_found"
  | "task_cancelled"
  | "task_not_shareable"
  | "share_cast_disabled"
  | "creator_ineligible"
  | "valid_wallet_required"
  | "farcaster_required";

export type ShareCastEligibilityInput = {
  task: Pick<
    Task2EarnTask,
    "id" | "creatorWallet" | "status" | "shareCastEnabled" | "createdAt"
  > | null;
  walletAddress: string;
  /** Server-resolved claimer FID. Never taken from the request body. */
  fid: number | null;
  /** Server-resolved creator FID from task.creatorWallet. Never from the client. */
  creatorFid?: number | null;
};

export function shareCastClaimId(taskId: string, fid: number): string {
  return `share_cast:${taskId.trim().toLowerCase()}:${fid}`;
}

export function catalogShareCastAmountBqr(clientAmount?: unknown): number {
  void clientAmount;
  return SHARE_CAST_REWARD_BQR;
}

export function parseShareRewardRequest(body: unknown): {
  wallet: string | null;
  castHashHint: string | null;
} {
  const record =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  void record.amount;
  void record.amountBqr;
  void record.reward;
  void record.fid;
  void record.creatorFid;
  void record.creator_fid;
  void record.shared;
  void record.completed;

  const walletRaw =
    typeof record.wallet === "string"
      ? record.wallet
      : typeof record.walletAddress === "string"
        ? record.walletAddress
        : "";
  const wallet = isValidWalletAddress(walletRaw)
    ? normalizeWalletAddress(walletRaw)
    : null;

  const hintRaw =
    typeof record.castHash === "string"
      ? record.castHash.trim()
      : typeof record.hash === "string"
        ? record.hash.trim()
        : "";

  return {
    wallet,
    castHashHint: hintRaw || null,
  };
}

export function evaluateShareCastEligibility(
  input: ShareCastEligibilityInput,
): { ok: true } | { ok: false; error: ShareCastEligibilityError; status: number } {
  if (!input.walletAddress || !isValidWalletAddress(input.walletAddress)) {
    return { ok: false, error: "valid_wallet_required", status: 400 };
  }
  if (!input.task) {
    return { ok: false, error: "task_not_found", status: 404 };
  }
  if (input.task.status === "cancelled") {
    return { ok: false, error: "task_cancelled", status: 409 };
  }
  if (!SHARE_CAST_ELIGIBLE_STATUSES.includes(input.task.status)) {
    return { ok: false, error: "task_not_shareable", status: 409 };
  }
  if (!input.task.shareCastEnabled) {
    return { ok: false, error: "share_cast_disabled", status: 409 };
  }
  if (
    input.task.creatorWallet.toLowerCase() ===
    input.walletAddress.toLowerCase()
  ) {
    return { ok: false, error: "creator_ineligible", status: 403 };
  }
  if (!input.fid || !Number.isInteger(input.fid) || input.fid <= 0) {
    return { ok: false, error: "farcaster_required", status: 400 };
  }
  if (
    typeof input.creatorFid === "number" &&
    Number.isInteger(input.creatorFid) &&
    input.creatorFid > 0 &&
    input.creatorFid === input.fid
  ) {
    return { ok: false, error: "creator_ineligible", status: 403 };
  }
  return { ok: true };
}

export function numericAmount(value: string | number | null | undefined): number {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

export function sumCreditedBqr(
  rows: ReadonlyArray<{ amount_bqr?: string | number; status?: string }>,
): number {
  return rows.reduce((total, row) => {
    if (row.status !== "credited") {
      return total;
    }
    return total + numericAmount(row.amount_bqr);
  }, 0);
}

export function mapLedgerEntry(row: T2eRewardLedgerRow): ShareCastRewardEntry {
  return {
    id: row.id,
    claimId: row.claim_id,
    rewardType: "share_cast",
    source: "farcaster_share",
    referenceId: row.reference_id,
    amountBqr: numericAmount(row.amount_bqr),
    status: row.status,
    castHash: row.cast_hash,
    createdAt: row.created_at,
    creditedAt: row.credited_at,
  };
}

export type ExistingShareCredit = {
  ledger: T2eRewardLedgerRow;
  alreadyCredited: true;
};

export function existingCreditedShare(params: {
  claimId: string;
  taskId: string;
  walletAddress: string;
  fid: number;
  ledgers: readonly T2eRewardLedgerRow[];
}): ExistingShareCredit | null {
  const credited = params.ledgers.filter((row) => row.status === "credited");
  const byClaim = credited.find((row) => row.claim_id === params.claimId);
  if (byClaim) {
    return { ledger: byClaim, alreadyCredited: true };
  }
  const byFid = credited.find(
    (row) =>
      row.reward_type === SHARE_CAST_REWARD_TYPE &&
      row.reference_id === params.taskId &&
      row.fid === params.fid,
  );
  if (byFid) {
    return { ledger: byFid, alreadyCredited: true };
  }
  const byWallet = credited.find(
    (row) =>
      row.reward_type === SHARE_CAST_REWARD_TYPE &&
      row.reference_id === params.taskId &&
      row.wallet_address.toLowerCase() === params.walletAddress.toLowerCase(),
  );
  if (byWallet) {
    return { ledger: byWallet, alreadyCredited: true };
  }
  return null;
}
