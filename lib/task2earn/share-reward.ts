import {
  fetchCastByHashOrUrl,
  fetchUserCastsPage,
  lookupFidByWalletAddress,
} from "@/lib/farcaster/neynar";
import { canonicalShareRewardsUrl, canonicalTaskUrl } from "@/lib/miniapp/share";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSupabaseError } from "@/lib/supabase/errors";
import {
  SHARE_CAST_REWARD_SOURCE,
  SHARE_CAST_REWARD_TYPE,
  SHARE_REWARDS_REWARD_TYPE,
  T2E_EARNED_BQR_LABEL,
} from "@/lib/task2earn/constants";
import {
  T2E_TABLES,
  type T2eRewardLedgerRow,
  type T2eShareRow,
} from "@/lib/task2earn/db";
import { getMarketplaceTask } from "@/lib/task2earn/server";
import {
  catalogShareCastAmountBqr,
  classifyStandaloneLedgerInsertError,
  evaluateShareCastEligibility,
  existingCreditedShare,
  mapLedgerEntry,
  parseShareRewardRequest,
  shareCastClaimId,
  sumCreditedBqr,
  buildStandaloneLedgerInsert,
} from "@/lib/task2earn/share-reward-logic";
import {
  applyOnChainShareRewardCooldown,
  buildShareRewardsCampaign,
  latestPaidAt,
  nextShareRewardEligibleAt,
  type ShareRewardsCampaign,
} from "@/lib/task2earn/share-rewards-display";
import {
  applySharePoolAuthorizationToCampaign,
  authorizeVerifiedShare,
  shouldAuthorizeVerifiedShare,
} from "@/lib/task2earn/share-pool-authorize";
import {
  evaluateShareCastProof,
  extractFeedCursor,
  extractShareCasts,
  findMatchingShareCast,
  parseShareCast,
  SHARE_CAST_SCAN_MAX_PAGES,
  SHARE_CAST_SCAN_PAGE_LIMIT,
  type ParsedShareCast,
  type ShareCastProofReason,
} from "@/lib/task2earn/share-verify";
import type { Task2EarnEarnedRewards } from "@/lib/task2earn/types";
import { normalizeWalletAddress } from "@/lib/x/config";
import { BQR_SHARE_REWARDS_POOL_ABI } from "@/lib/contracts/abi/BqrShareRewardsPool";
import { getBqrShareRewardsPoolAddress, resolveShareRewardsClaimPoolAddress } from "@/lib/contracts/shareRewardsPool";
import { getBasePublicClient } from "@/lib/rewards/server/baseClient";
import {
  isStandalonePendingRow,
} from "@/lib/task2earn/share-pool-flow";

export {
  catalogShareCastAmountBqr,
  evaluateShareCastEligibility,
  existingCreditedShare,
  parseShareRewardRequest,
  shareCastClaimId,
  shareRewardsClaimId,
  SHARE_CAST_ELIGIBLE_STATUSES,
  sumCreditedBqr,
  buildStandaloneLedgerInsert,
} from "@/lib/task2earn/share-reward-logic";

function requireAdmin() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    throw new Error("task2earn_unavailable");
  }
  return supabase;
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  return "code" in error && String(error.code) === "23505";
}

async function proveShareCast(params: {
  fid: number;
  expectedUrl: string;
  notBeforeMs: number;
  hashHint?: string | null;
  nowMs?: number;
}): Promise<
  | { ok: true; cast: ParsedShareCast }
  | { ok: false; reason: ShareCastProofReason }
> {
  const rules = {
    expectedFid: params.fid,
    taskUrl: params.expectedUrl,
    taskCreatedAtMs: params.notBeforeMs,
    nowMs: params.nowMs ?? Date.now(),
  };
  if (!Number.isFinite(rules.taskCreatedAtMs)) {
    return { ok: false, reason: "unfetchable" };
  }

  const hint = params.hashHint?.trim() ?? "";
  if (hint) {
    const lookup = await fetchCastByHashOrUrl({ hash: hint });
    const hinted = lookup ? parseShareCast(lookup) : null;
    if (hinted && evaluateShareCastProof(hinted, rules) === "valid") {
      return { ok: true, cast: hinted };
    }
  }

  let cursor: string | null = null;
  let lastReason: ShareCastProofReason = hint ? "unfetchable" : "missing_cast";
  for (let page = 0; page < SHARE_CAST_SCAN_MAX_PAGES; page += 1) {
    const payload = await fetchUserCastsPage({
      fid: params.fid,
      cursor,
      limit: SHARE_CAST_SCAN_PAGE_LIMIT,
      includeReplies: false,
    });
    if (!payload) {
      return { ok: false, reason: "unfetchable" };
    }
    const casts = extractShareCasts(payload);
    const match = findMatchingShareCast(casts, rules);
    if (match.cast) {
      return { ok: true, cast: match.cast };
    }
    lastReason = match.reason;
    cursor = extractFeedCursor(payload);
    if (!cursor) {
      break;
    }
  }

  return { ok: false, reason: lastReason };
}

export type CreditShareCastResult =
  | {
      ok: true;
      alreadyCredited: boolean;
      amountBqr: number;
      earnedBqr: number;
      claimId: string;
      castHash: string | null;
      label: typeof T2E_EARNED_BQR_LABEL;
    }
  | {
      ok: false;
      error: string;
      status: number;
      reason?: ShareCastProofReason;
    };

async function loadLedgerForWallet(
  walletAddress: string,
): Promise<T2eRewardLedgerRow[]> {
  const supabase = requireAdmin();
  const { data, error } = await supabase
    .from(T2E_TABLES.rewardLedger)
    .select("*")
    .eq("wallet_address", walletAddress)
    .order("created_at", { ascending: false });
  if (error) {
    logSupabaseError("loadLedgerForWallet", "select ledger", error, {
      walletAddress,
    });
    throw error;
  }
  return (data ?? []) as T2eRewardLedgerRow[];
}

async function loadExistingCredits(params: {
  taskId: string;
}): Promise<T2eRewardLedgerRow[]> {
  const supabase = requireAdmin();
  const { data, error } = await supabase
    .from(T2E_TABLES.rewardLedger)
    .select("*")
    .eq("reward_type", SHARE_CAST_REWARD_TYPE)
    .eq("reference_id", params.taskId);
  if (error) {
    logSupabaseError("loadExistingCredits", "select ledger", error, {
      taskId: params.taskId,
    });
    throw error;
  }
  return (data ?? []) as T2eRewardLedgerRow[];
}

async function insertShareRow(params: {
  taskId: string;
  walletAddress: string;
  fid: number;
  castHash: string;
  amountBqr: number;
}): Promise<T2eShareRow> {
  const supabase = requireAdmin();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from(T2E_TABLES.shares)
    .insert({
      task_id: params.taskId,
      wallet_address: params.walletAddress,
      fid: params.fid,
      share_kind: "cast",
      status: "verified",
      cast_hash: params.castHash,
      reward_bqr: params.amountBqr,
      verified_at: now,
      metadata: { source: SHARE_CAST_REWARD_SOURCE },
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: byWallet, error: walletError } = await supabase
        .from(T2E_TABLES.shares)
        .select("*")
        .eq("task_id", params.taskId)
        .eq("share_kind", "cast")
        .eq("wallet_address", params.walletAddress)
        .maybeSingle();
      if (walletError) {
        throw walletError;
      }
      if (byWallet) {
        return byWallet as T2eShareRow;
      }
      const { data: byFid, error: fidError } = await supabase
        .from(T2E_TABLES.shares)
        .select("*")
        .eq("task_id", params.taskId)
        .eq("share_kind", "cast")
        .eq("fid", params.fid)
        .maybeSingle();
      if (fidError) {
        throw fidError;
      }
      if (byFid) {
        return byFid as T2eShareRow;
      }
    }
    logSupabaseError("insertShareRow", "insert share", error, {
      taskId: params.taskId,
    });
    throw error;
  }

  return data as T2eShareRow;
}

async function insertLedgerRow(params: {
  claimId: string;
  walletAddress: string;
  fid: number;
  taskId: string;
  amountBqr: number;
  castHash: string;
  shareId: string | null;
}): Promise<{ row: T2eRewardLedgerRow; duplicate: boolean }> {
  const supabase = requireAdmin();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from(T2E_TABLES.rewardLedger)
    .insert({
      claim_id: params.claimId,
      wallet_address: params.walletAddress,
      fid: params.fid,
      reward_type: SHARE_CAST_REWARD_TYPE,
      source: SHARE_CAST_REWARD_SOURCE,
      reference_id: params.taskId,
      amount_bqr: params.amountBqr,
      status: "credited",
      cast_hash: params.castHash,
      share_id: params.shareId,
      credited_at: now,
      claimed_at: null,
      tx_hash: null,
    })
    .select("*")
    .single();

  if (error) {
    if (isUniqueViolation(error)) {
      const { data: existing, error: existingError } = await supabase
        .from(T2E_TABLES.rewardLedger)
        .select("*")
        .eq("claim_id", params.claimId)
        .maybeSingle();
      if (existingError) {
        throw existingError;
      }
      if (existing) {
        return { row: existing as T2eRewardLedgerRow, duplicate: true };
      }
    }
    logSupabaseError("insertLedgerRow", "insert ledger", error, {
      claimId: params.claimId,
    });
    throw error;
  }

  return { row: data as T2eRewardLedgerRow, duplicate: false };
}

async function lookupStandaloneLedgerRow(params: {
  claimId: string;
  castHash: string;
}): Promise<T2eRewardLedgerRow | null> {
  const supabase = requireAdmin();
  const { data: byClaim, error: claimError } = await supabase
    .from(T2E_TABLES.rewardLedger)
    .select("*")
    .eq("claim_id", params.claimId)
    .maybeSingle();
  if (claimError) {
    throw claimError;
  }
  if (byClaim) {
    return byClaim as T2eRewardLedgerRow;
  }
  const { data: byHash, error: hashError } = await supabase
    .from(T2E_TABLES.rewardLedger)
    .select("*")
    .eq("cast_hash", params.castHash)
    .maybeSingle();
  if (hashError) {
    throw hashError;
  }
  return (byHash as T2eRewardLedgerRow | null) ?? null;
}

async function insertStandaloneLedgerRow(params: {
  walletAddress: string;
  fid: number;
  castHash: string;
}): Promise<{ row: T2eRewardLedgerRow; duplicate: boolean }> {
  const supabase = requireAdmin();
  const now = new Date().toISOString();
  const payload = buildStandaloneLedgerInsert({
    fid: params.fid,
    walletAddress: params.walletAddress,
    castHash: params.castHash,
    creditedAtIso: now,
  });
  const { data, error } = await supabase
    .from(T2E_TABLES.rewardLedger)
    .insert({
      claim_id: payload.claim_id,
      wallet_address: payload.wallet_address,
      fid: payload.fid,
      reward_type: payload.reward_type,
      source: payload.source,
      reference_id: payload.reference_id,
      amount_bqr: payload.amount_bqr,
      status: payload.status,
      cast_hash: payload.cast_hash,
      share_id: payload.share_id,
      credited_at: payload.credited_at,
      claimed_at: payload.claimed_at,
      tx_hash: payload.tx_hash,
    })
    .select("*")
    .single();

  if (error) {
    const conflict = classifyStandaloneLedgerInsertError(error);
    if (conflict === "duplicate") {
      const existing = await lookupStandaloneLedgerRow({
        claimId: payload.claim_id,
        castHash: payload.cast_hash,
      });
      if (existing) {
        return { row: existing, duplicate: true };
      }
    }
    logSupabaseError("insertStandaloneLedgerRow", "insert ledger", error, {
      claimId: payload.claim_id,
    });
    throw error;
  }

  return { row: data as T2eRewardLedgerRow, duplicate: false };
}

async function attachShareToLedger(ledgerId: string, shareId: string) {
  const supabase = requireAdmin();
  const { error } = await supabase
    .from(T2E_TABLES.rewardLedger)
    .update({ share_id: shareId })
    .eq("id", ledgerId);
  if (error) {
    logSupabaseError("attachShareToLedger", "update ledger share_id", error, {
      ledgerId,
    });
  }
}

function creditedResponse(
  ledger: T2eRewardLedgerRow,
  alreadyCredited: boolean,
  earnedBqr: number,
): Extract<CreditShareCastResult, { ok: true }> {
  return {
    ok: true,
    alreadyCredited,
    amountBqr: catalogShareCastAmountBqr(),
    earnedBqr,
    claimId: ledger.claim_id,
    castHash: ledger.cast_hash,
    label: T2E_EARNED_BQR_LABEL,
  };
}

export async function creditShareCastReward(params: {
  taskId: string;
  walletAddress: string;
  castHashHint?: string | null;
}): Promise<CreditShareCastResult> {
  const walletAddress = normalizeWalletAddress(params.walletAddress);
  const task = await getMarketplaceTask(params.taskId, walletAddress);

  let fid: number | null = null;
  try {
    fid = await lookupFidByWalletAddress(walletAddress);
  } catch (error) {
    console.error("[task2earn] FID lookup failed during share reward", error);
    return { ok: false, error: "unfetchable", status: 503, reason: "unfetchable" };
  }

  let creatorFid: number | null = null;
  if (task?.creatorWallet) {
    try {
      creatorFid = await lookupFidByWalletAddress(task.creatorWallet);
    } catch (error) {
      console.error(
        "[task2earn] creator FID lookup failed during share reward",
        error,
      );
      return { ok: false, error: "unfetchable", status: 503, reason: "unfetchable" };
    }
  }

  const eligibility = evaluateShareCastEligibility({
    task,
    walletAddress,
    fid,
    creatorFid,
  });
  if (!eligibility.ok) {
    return {
      ok: false,
      error: eligibility.error,
      status: eligibility.status,
    };
  }
  if (!task || !fid) {
    return { ok: false, error: "task_not_found", status: 404 };
  }

  const claimId = shareCastClaimId(task.id, fid);
  const existingRows = await loadExistingCredits({ taskId: task.id });
  const existing = existingCreditedShare({
    claimId,
    taskId: task.id,
    walletAddress,
    fid,
    ledgers: existingRows,
  });
  if (existing) {
    const earned = await listWalletShareRewards(walletAddress);
    const sameWallet =
      existing.ledger.wallet_address.toLowerCase() === walletAddress;
    if (!sameWallet) {
      return { ok: false, error: "already_credited", status: 409 };
    }
    return creditedResponse(existing.ledger, true, earned.earnedBqr);
  }

  const proof = await proveShareCast({
    fid,
    expectedUrl: canonicalTaskUrl(task.id),
    notBeforeMs: Date.parse(task.createdAt),
    hashHint: params.castHashHint,
  });
  if (!proof.ok) {
    return {
      ok: false,
      error: "proof_failed",
      status: 422,
      reason: proof.reason,
    };
  }

  const amountBqr = catalogShareCastAmountBqr();
  const inserted = await insertLedgerRow({
    claimId,
    walletAddress,
    fid,
    taskId: task.id,
    amountBqr,
    castHash: proof.cast.hash,
    shareId: null,
  });
  if (
    inserted.duplicate &&
    inserted.row.wallet_address.toLowerCase() !== walletAddress
  ) {
    return { ok: false, error: "already_credited", status: 409 };
  }

  if (!inserted.duplicate) {
    const share = await insertShareRow({
      taskId: task.id,
      walletAddress,
      fid,
      castHash: proof.cast.hash,
      amountBqr,
    });
    await attachShareToLedger(inserted.row.id, share.id);
  }

  const earned = await listWalletShareRewards(walletAddress);
  return creditedResponse(inserted.row, inserted.duplicate, earned.earnedBqr);
}

export async function listWalletShareRewards(
  walletAddress: string,
): Promise<Task2EarnEarnedRewards> {
  const normalized = normalizeWalletAddress(walletAddress);
  const rows = await loadLedgerForWallet(normalized);
  const credited = rows.filter((row) => row.status === "credited");
  return {
    label: T2E_EARNED_BQR_LABEL,
    earnedBqr: sumCreditedBqr(credited),
    entries: credited.map(mapLedgerEntry),
  };
}

function isMissingLedgerError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const code = "code" in error ? String(error.code) : "";
  const message = "message" in error ? String(error.message).toLowerCase() : "";
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    message.includes("t2e_reward_ledger") ||
    message.includes("does not exist") ||
    message.includes("schema cache")
  );
}

async function sumAllStandaloneCreditedBqr(): Promise<number> {
  const supabase = requireAdmin();
  const { data, error } = await supabase
    .from(T2E_TABLES.rewardLedger)
    .select("amount_bqr, status, reward_type")
    .eq("reward_type", SHARE_REWARDS_REWARD_TYPE)
    .eq("status", "credited");
  if (error) {
    if (isMissingLedgerError(error)) {
      return 0;
    }
    logSupabaseError("sumAllStandaloneCreditedBqr", "select ledger", error);
    throw error;
  }
  return sumCreditedBqr(data ?? []);
}

async function loadStandaloneLedgerForWallet(
  walletAddress: string,
): Promise<T2eRewardLedgerRow[]> {
  const supabase = requireAdmin();
  const { data, error } = await supabase
    .from(T2E_TABLES.rewardLedger)
    .select("*")
    .eq("wallet_address", walletAddress)
    .eq("reward_type", SHARE_REWARDS_REWARD_TYPE)
    .order("created_at", { ascending: false });
  if (error) {
    if (isMissingLedgerError(error)) {
      return [];
    }
    logSupabaseError("loadStandaloneLedgerForWallet", "select ledger", error, {
      walletAddress,
    });
    throw error;
  }
  return (data ?? []) as T2eRewardLedgerRow[];
}

async function loadLatestStandaloneActivityAtForFid(
  fid: number,
): Promise<string | null> {
  const supabase = requireAdmin();
  const { data, error } = await supabase
    .from(T2E_TABLES.rewardLedger)
    .select("credited_at, claimed_at, status")
    .eq("fid", fid)
    .eq("reward_type", SHARE_REWARDS_REWARD_TYPE)
    .in("status", ["pending", "credited"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (isMissingLedgerError(error)) {
      return null;
    }
    logSupabaseError(
      "loadLatestStandaloneActivityAtForFid",
      "select ledger",
      error,
      { fid },
    );
    throw error;
  }
  if (!data || typeof data !== "object") {
    return null;
  }
  const claimedAt =
    "claimed_at" in data && typeof data.claimed_at === "string"
      ? data.claimed_at
      : null;
  const creditedAt =
    "credited_at" in data && typeof data.credited_at === "string"
      ? data.credited_at
      : null;
  return claimedAt || creditedAt;
}

function attachClaimPoolAddress(
  campaign: ShareRewardsCampaign,
): ShareRewardsCampaign {
  return {
    ...campaign,
    claimPoolAddress: resolveShareRewardsClaimPoolAddress(),
  };
}

async function readSharePoolRemainingBqr(): Promise<number | null> {
  try {
    const pool = getBqrShareRewardsPoolAddress();
    if (!pool) {
      return null;
    }
    const client = getBasePublicClient();
    const balance = await client.readContract({
      abi: BQR_SHARE_REWARDS_POOL_ABI,
      address: pool,
      functionName: "tokenBalance",
    });
    return Number(balance) / 1e18;
  } catch (error) {
    console.error("[task2earn] share pool tokenBalance read failed", error);
    return null;
  }
}

async function readSharePoolFidNextEligibleAt(
  fid: number,
): Promise<string | null> {
  try {
    const pool = getBqrShareRewardsPoolAddress();
    if (!pool || !Number.isInteger(fid) || fid <= 0) {
      return null;
    }
    const client = getBasePublicClient();
    const next = await client.readContract({
      abi: BQR_SHARE_REWARDS_POOL_ABI,
      address: pool,
      functionName: "nextEligibleAt",
      args: [BigInt(fid)],
    });
    if (typeof next !== "bigint" || next === 0n) {
      return null;
    }
    return new Date(Number(next) * 1000).toISOString();
  } catch (error) {
    console.error("[task2earn] share pool nextEligibleAt read failed", error);
    return null;
  }
}

function fidFromStandaloneRows(rows: T2eRewardLedgerRow[]): number | null {
  for (const row of rows) {
    if (
      row.reward_type === SHARE_REWARDS_REWARD_TYPE &&
      typeof row.fid === "number" &&
      Number.isInteger(row.fid) &&
      row.fid > 0
    ) {
      return row.fid;
    }
  }
  return null;
}

function campaignFromRows(
  rows: T2eRewardLedgerRow[],
  creditedPoolBqr: number,
  poolRemainingBqr: number | null,
): ShareRewardsCampaign {
  const credited = rows.filter((row) => row.status === "credited");
  const pending = rows.find((row) => isStandalonePendingRow(row)) ?? null;
  return buildShareRewardsCampaign({
    creditedPoolBqr,
    earnedBqr: sumCreditedBqr(credited),
    lastCreditedAt: latestPaidAt(rows),
    poolRemainingBqr: poolRemainingBqr ?? undefined,
    claimable: Boolean(pending),
    claimFid: pending?.fid ?? null,
    claimCastHash: pending?.cast_hash ?? null,
    qualifiedWallet: pending?.wallet_address ?? null,
  });
}

export async function getShareRewardsCampaign(
  walletAddress?: string | null,
): Promise<ShareRewardsCampaign> {
  try {
    const creditedPoolBqr = await sumAllStandaloneCreditedBqr();
    const onChainRemaining = await readSharePoolRemainingBqr();
    if (!walletAddress) {
      return attachClaimPoolAddress(
        buildShareRewardsCampaign({
          creditedPoolBqr,
          earnedBqr: 0,
          lastCreditedAt: null,
          poolRemainingBqr: onChainRemaining ?? undefined,
        }),
      );
    }
    const rows = await loadStandaloneLedgerForWallet(walletAddress);
    const campaign = campaignFromRows(
      rows,
      creditedPoolBqr,
      onChainRemaining,
    );
    const fid = campaign.claimFid ?? fidFromStandaloneRows(rows);
    const onChainNextEligibleAt = fid
      ? await readSharePoolFidNextEligibleAt(fid)
      : null;
    return attachClaimPoolAddress(
      applyOnChainShareRewardCooldown(campaign, onChainNextEligibleAt),
    );
  } catch (error) {
    if (isMissingLedgerError(error)) {
      return attachClaimPoolAddress(
        buildShareRewardsCampaign({
          creditedPoolBqr: 0,
          earnedBqr: 0,
          lastCreditedAt: null,
        }),
      );
    }
    throw error;
  }
}

export type VerifyDailyShareResult =
  | {
      ok: true;
      alreadyClaimed: boolean;
      verified: boolean;
      campaign: ShareRewardsCampaign;
      castHash: string | null;
      qualifiedOnchain: boolean;
    }
  | {
      ok: false;
      error: string;
      status: number;
      reason?: ShareCastProofReason;
      campaign?: ShareRewardsCampaign;
    };

export type VerifyDailyShareDeps = {
  authorizeVerifiedShare?: typeof authorizeVerifiedShare;
};

export async function verifyDailyShareReward(
  params: {
    walletAddress: string;
    castHashHint?: string | null;
  },
  deps?: VerifyDailyShareDeps,
): Promise<VerifyDailyShareResult> {
  const parsed = parseShareRewardRequest({
    wallet: params.walletAddress,
    castHash: params.castHashHint,
  });
  if (!parsed.wallet) {
    return { ok: false, error: "valid_wallet_required", status: 400 };
  }

  let fid: number | null = null;
  try {
    fid = await lookupFidByWalletAddress(parsed.wallet);
  } catch (error) {
    console.error("[task2earn] FID lookup failed during daily share verify", error);
    return { ok: false, error: "unfetchable", status: 503, reason: "unfetchable" };
  }
  if (!fid || !Number.isInteger(fid) || fid <= 0) {
    return { ok: false, error: "farcaster_required", status: 400 };
  }

  const authorizeShare = deps?.authorizeVerifiedShare ?? authorizeVerifiedShare;
  const latestActivity = await loadLatestStandaloneActivityAtForFid(fid);
  const campaign = await getShareRewardsCampaign(parsed.wallet);
  if (campaign.claimable) {
    const decision = shouldAuthorizeVerifiedShare({
      proofOk: true,
      alreadyClaimable: true,
      claimedToday: false,
      cooldownActive: false,
      poolLive: campaign.live,
      ledgerInserted: true,
      ledgerDuplicate: true,
    });
    let qualifiedOnchain = false;
    let nextCampaign = campaign;
    if (decision.authorize && campaign.claimCastHash) {
      const auth = await authorizeShare({
        account: parsed.wallet,
        fid,
        castHash: campaign.claimCastHash,
      });
      const applied = applySharePoolAuthorizationToCampaign(campaign, auth);
      nextCampaign = applied.campaign;
      qualifiedOnchain = applied.qualifiedOnchain;
    }
    return {
      ok: true,
      alreadyClaimed: true,
      verified: true,
      campaign: nextCampaign,
      castHash: nextCampaign.claimCastHash ?? campaign.claimCastHash,
      qualifiedOnchain,
    };
  }
  if (nextShareRewardEligibleAt(latestActivity) || campaign.claimedToday) {
    return {
      ok: true,
      alreadyClaimed: true,
      verified: true,
      campaign,
      castHash: null,
      qualifiedOnchain: false,
    };
  }
  if (!campaign.live) {
    return {
      ok: false,
      error: "pool_depleted",
      status: 409,
      campaign,
    };
  }

  const proof = await proveShareCast({
    fid,
    expectedUrl: canonicalShareRewardsUrl(),
    notBeforeMs: 0,
    hashHint: parsed.castHashHint,
  });
  if (!proof.ok) {
    return {
      ok: false,
      error: "proof_failed",
      status: 422,
      reason: proof.reason,
      campaign,
    };
  }

  try {
    const inserted = await insertStandaloneLedgerRow({
      walletAddress: parsed.wallet,
      fid,
      castHash: proof.cast.hash,
    });
    const castHash = inserted.row.cast_hash ?? proof.cast.hash;
    const decision = shouldAuthorizeVerifiedShare({
      proofOk: true,
      alreadyClaimable: false,
      claimedToday: false,
      cooldownActive: false,
      poolLive: true,
      ledgerInserted: true,
      ledgerDuplicate: inserted.duplicate,
    });
    const fresh = await getShareRewardsCampaign(parsed.wallet);
    if (!decision.authorize) {
      return {
        ok: true,
        alreadyClaimed: inserted.duplicate,
        verified: true,
        campaign: fresh,
        castHash,
        qualifiedOnchain: false,
      };
    }
    const auth = await authorizeShare({
      account: parsed.wallet,
      fid,
      castHash,
    });
    const applied = applySharePoolAuthorizationToCampaign(fresh, auth);
    return {
      ok: true,
      alreadyClaimed: inserted.duplicate,
      verified: true,
      campaign: applied.campaign,
      castHash,
      qualifiedOnchain: applied.qualifiedOnchain,
    };
  } catch (error) {
    const conflict = classifyStandaloneLedgerInsertError(error);
    const fresh = await getShareRewardsCampaign(parsed.wallet);
    const decision = shouldAuthorizeVerifiedShare({
      proofOk: true,
      alreadyClaimable: false,
      claimedToday: false,
      cooldownActive: conflict === "cooldown",
      poolLive: conflict !== "pool_depleted",
      ledgerInserted: false,
      ledgerDuplicate: conflict === "duplicate",
      ledgerConflict:
        conflict === "duplicate" ||
        conflict === "cooldown" ||
        conflict === "pool_depleted"
          ? conflict
          : "failed",
    });
    if (conflict === "duplicate" && decision.authorize) {
      const auth = await authorizeShare({
        account: parsed.wallet,
        fid,
        castHash: proof.cast.hash,
      });
      const applied = applySharePoolAuthorizationToCampaign(fresh, auth);
      return {
        ok: true,
        alreadyClaimed: true,
        verified: true,
        campaign: applied.campaign,
        castHash: proof.cast.hash,
        qualifiedOnchain: applied.qualifiedOnchain,
      };
    }
    if (conflict === "duplicate" || conflict === "cooldown") {
      return {
        ok: true,
        alreadyClaimed: true,
        verified: true,
        campaign: fresh,
        castHash: proof.cast.hash,
        qualifiedOnchain: false,
      };
    }
    if (conflict === "pool_depleted") {
      return {
        ok: false,
        error: "pool_depleted",
        status: 409,
        campaign: fresh,
      };
    }
    throw error;
  }
}
