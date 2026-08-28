/**
 * Confirm a user claim tx against BqrShareRewardsPool, then mark the ledger paid.
 * Never marks paid without a successful on-chain receipt.
 */

import { BQR_SHARE_REWARDS_POOL_ABI } from "@/lib/contracts/abi/BqrShareRewardsPool";
import {
  resolveShareRewardsClaimPoolAddress,
  SHARE_POOL_REWARD_AMOUNT_WEI,
  toSharePoolCastHash,
} from "@/lib/contracts/shareRewardsPool";
import { getBasePublicClient } from "@/lib/rewards/server/baseClient";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSupabaseError } from "@/lib/supabase/errors";
import { T2E_TABLES, type T2eRewardLedgerRow } from "@/lib/task2earn/db";
import {
  decideLedgerAfterClaimReceipt,
  isStandalonePaidRow,
  isStandalonePendingRow,
  type ClaimReceiptView,
} from "@/lib/task2earn/share-pool-flow";
import { SHARE_REWARDS_REWARD_TYPE } from "@/lib/task2earn/constants";
import { getAddress, isHash, parseEventLogs, type Address, type Hash, type Hex, type Log } from "viem";

export type ConfirmSharePoolClaimResult =
  | {
      ok: true;
      alreadyPaid: boolean;
      txHash: string;
      amountBqr: number;
    }
  | { ok: false; error: string; status: number };

function requireAdmin() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    throw new Error("task2earn_unavailable");
  }
  return supabase;
}

export function parseShareRewardClaimedReceipt(params: {
  logs: readonly Log[];
  poolAddress: Address;
  walletAddress: Address;
  fid: bigint;
  castHash: Hex;
  txHash: string;
  receiptStatus: "success" | "reverted";
}): ClaimReceiptView | null {
  if (params.receiptStatus !== "success") {
    return {
      status: "reverted",
      account: params.walletAddress,
      fid: params.fid,
      castHash: params.castHash,
      amountWei: 0n,
      txHash: params.txHash,
    };
  }
  const claimedLogs = parseEventLogs({
    abi: BQR_SHARE_REWARDS_POOL_ABI,
    eventName: "ShareRewardClaimed",
    logs: [...params.logs],
  });
  const match = claimedLogs.find(
    (log) =>
      log.address.toLowerCase() === params.poolAddress.toLowerCase() &&
      log.args.account?.toLowerCase() === params.walletAddress.toLowerCase() &&
      log.args.fid === params.fid &&
      log.args.castHash?.toLowerCase() === params.castHash.toLowerCase() &&
      log.args.amount === SHARE_POOL_REWARD_AMOUNT_WEI,
  );
  if (!match?.args.account || match.args.amount == null || !match.args.castHash) {
    return null;
  }
  return {
    status: "success",
    account: getAddress(match.args.account),
    fid: match.args.fid ?? params.fid,
    castHash: match.args.castHash,
    amountWei: match.args.amount,
    txHash: params.txHash,
  };
}

export async function confirmSharePoolClaim(params: {
  walletAddress: string;
  txHash: string;
}): Promise<ConfirmSharePoolClaimResult> {
  if (!isHash(params.txHash)) {
    return { ok: false, error: "invalid_tx_hash", status: 400 };
  }

  const supabase = requireAdmin();
  const wallet = getAddress(params.walletAddress);
  const { data, error } = await supabase
    .from(T2E_TABLES.rewardLedger)
    .select("*")
    .eq("wallet_address", wallet)
    .eq("reward_type", SHARE_REWARDS_REWARD_TYPE)
    .order("created_at", { ascending: false });
  if (error) {
    logSupabaseError("confirmSharePoolClaim", "select ledger", error, { wallet });
    throw error;
  }
  const rows = (data ?? []) as T2eRewardLedgerRow[];
  const pending =
    rows.find((row) => isStandalonePendingRow(row)) ??
    rows.find((row) => isStandalonePaidRow(row) && row.tx_hash === params.txHash) ??
    null;
  if (!pending) {
    return { ok: false, error: "no_pending_row", status: 409 };
  }
  if (!pending.cast_hash || !pending.fid) {
    return { ok: false, error: "invalid_cast_hash", status: 409 };
  }

  const pool = resolveShareRewardsClaimPoolAddress();
  if (!pool) {
    return { ok: false, error: "pool_unconfigured", status: 503 };
  }

  const client = getBasePublicClient();
  const receipt = await client.getTransactionReceipt({
    hash: params.txHash as Hash,
  });
  const parsed = parseShareRewardClaimedReceipt({
    logs: receipt.logs,
    poolAddress: pool,
    walletAddress: wallet,
    fid: BigInt(pending.fid),
    castHash: toSharePoolCastHash(pending.cast_hash),
    txHash: params.txHash,
    receiptStatus: receipt.status === "success" ? "success" : "reverted",
  });

  const decision = decideLedgerAfterClaimReceipt({
    connectedWallet: wallet,
    qualifiedWallet: pending.wallet_address,
    pending,
    receipt: parsed,
  });

  if (!decision.ok) {
    return { ok: false, error: decision.error, status: 409 };
  }
  if (!decision.markPaid) {
    return {
      ok: true,
      alreadyPaid: true,
      txHash: decision.txHash,
      amountBqr: 25,
    };
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from(T2E_TABLES.rewardLedger)
    .update({
      status: "credited",
      tx_hash: decision.txHash,
      claimed_at: now,
    })
    .eq("claim_id", pending.claim_id)
    .eq("status", "pending")
    .is("tx_hash", null);
  if (updateError) {
    logSupabaseError("confirmSharePoolClaim", "update ledger", updateError, {
      claimId: pending.claim_id,
    });
    throw updateError;
  }

  return {
    ok: true,
    alreadyPaid: false,
    txHash: decision.txHash,
    amountBqr: decision.amountBqr,
  };
}
