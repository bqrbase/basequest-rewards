import {
  BQR_SHARE_REWARDS_POOL_BQR,
  SHARE_CAST_MAX_AGE_MS,
  SHARE_CAST_REWARD_BQR,
} from "./constants";

/** Configured Share Rewards pool size for display. On-chain remaining is preferred. */
export { BQR_SHARE_REWARDS_POOL_BQR };

export type ShareRewardsCampaign = {
  poolConfiguredBqr: number;
  poolRemainingBqr: number;
  dailyRewardBqr: number;
  live: boolean;
  earnedBqr: number;
  lastCreditedAt: string | null;
  nextEligibleAt: string | null;
  claimedToday: boolean;
  claimable: boolean;
  claimFid: number | null;
  claimCastHash: string | null;
  qualifiedWallet: string | null;
  /** Server-resolved claim pool; client uses for claimBqrShareReward when set. */
  claimPoolAddress: string | null;
};

export function remainingShareRewardsPool(creditedBqr: number): number {
  const credited = Number.isFinite(creditedBqr) ? Math.max(0, creditedBqr) : 0;
  return Math.max(0, BQR_SHARE_REWARDS_POOL_BQR - credited);
}

export function isShareRewardsLive(
  remainingBqr: number,
  dailyRewardBqr = SHARE_CAST_REWARD_BQR,
): boolean {
  return remainingBqr >= dailyRewardBqr;
}

export function nextShareRewardEligibleAt(
  lastCreditedAtIso: string | null,
  nowMs = Date.now(),
): string | null {
  if (!lastCreditedAtIso) {
    return null;
  }
  const last = Date.parse(lastCreditedAtIso);
  if (!Number.isFinite(last)) {
    return null;
  }
  const next = last + SHARE_CAST_MAX_AGE_MS;
  return next > nowMs ? new Date(next).toISOString() : null;
}

export function latestCreditedAt(
  rows: ReadonlyArray<{ status?: string; credited_at?: string | null }>,
): string | null {
  let latestMs = 0;
  let latestIso: string | null = null;
  for (const row of rows) {
    if (row.status !== "credited" || !row.credited_at) {
      continue;
    }
    const ms = Date.parse(row.credited_at);
    if (!Number.isFinite(ms) || ms <= latestMs) {
      continue;
    }
    latestMs = ms;
    latestIso = row.credited_at;
  }
  return latestIso;
}

export function latestPaidAt(
  rows: ReadonlyArray<{
    status?: string;
    claimed_at?: string | null;
    credited_at?: string | null;
  }>,
): string | null {
  let latestMs = 0;
  let latestIso: string | null = null;
  for (const row of rows) {
    if (row.status !== "credited") {
      continue;
    }
    const iso = row.claimed_at || row.credited_at;
    if (!iso) {
      continue;
    }
    const ms = Date.parse(iso);
    if (!Number.isFinite(ms) || ms <= latestMs) {
      continue;
    }
    latestMs = ms;
    latestIso = iso;
  }
  return latestIso;
}

export function buildShareRewardsCampaign(params: {
  creditedPoolBqr: number;
  earnedBqr: number;
  lastCreditedAt: string | null;
  nowMs?: number;
  poolRemainingBqr?: number;
  claimable?: boolean;
  claimFid?: number | null;
  claimCastHash?: string | null;
  qualifiedWallet?: string | null;
  claimPoolAddress?: string | null;
}): ShareRewardsCampaign {
  const nowMs = params.nowMs ?? Date.now();
  const poolRemainingBqr =
    typeof params.poolRemainingBqr === "number"
      ? Math.max(0, params.poolRemainingBqr)
      : remainingShareRewardsPool(params.creditedPoolBqr);
  const nextEligibleAt = nextShareRewardEligibleAt(params.lastCreditedAt, nowMs);
  const paidToday = Boolean(nextEligibleAt);
  return {
    poolConfiguredBqr: BQR_SHARE_REWARDS_POOL_BQR,
    poolRemainingBqr,
    dailyRewardBqr: SHARE_CAST_REWARD_BQR,
    live: isShareRewardsLive(poolRemainingBqr),
    earnedBqr: params.earnedBqr,
    lastCreditedAt: params.lastCreditedAt,
    nextEligibleAt,
    claimedToday: paidToday,
    claimable: Boolean(params.claimable) && !paidToday,
    claimFid: params.claimFid ?? null,
    claimCastHash: params.claimCastHash ?? null,
    qualifiedWallet: params.qualifiedWallet ?? null,
    claimPoolAddress: params.claimPoolAddress ?? null,
  };
}

/** Hide Claim when production authorization did not succeed. */
export function suppressShareRewardClaimable(
  campaign: ShareRewardsCampaign,
): ShareRewardsCampaign {
  return {
    ...campaign,
    claimable: false,
    claimFid: null,
    claimCastHash: null,
    qualifiedWallet: null,
  };
}

export {
  applySharePoolPendingClaimGate,
  finalizeShareRewardsCampaign,
} from "./share-rewards-pending-gate";
export type { SharePoolPendingClaimOnChain } from "./share-rewards-pending-gate";

/** Local UI state immediately after a successful on-chain claim receipt. */
export function campaignAfterSuccessfulClaim(
  campaign: ShareRewardsCampaign,
  nowMs = Date.now(),
): ShareRewardsCampaign {
  return buildShareRewardsCampaign({
    creditedPoolBqr: 0,
    earnedBqr: campaign.earnedBqr + campaign.dailyRewardBqr,
    lastCreditedAt: new Date(nowMs).toISOString(),
    nowMs,
    poolRemainingBqr: Math.max(
      0,
      campaign.poolRemainingBqr - campaign.dailyRewardBqr,
    ),
    claimable: false,
    claimPoolAddress: campaign.claimPoolAddress,
  });
}

/**
 * If the pool reports an active FID cooldown, the Claim button must stay hidden
 * even when a pending ledger row has not been marked credited yet.
 */
export function applyOnChainShareRewardCooldown(
  campaign: ShareRewardsCampaign,
  onChainNextEligibleAtIso: string | null,
  nowMs = Date.now(),
): ShareRewardsCampaign {
  if (!onChainNextEligibleAtIso) {
    return campaign;
  }
  const next = Date.parse(onChainNextEligibleAtIso);
  if (!Number.isFinite(next) || next <= nowMs) {
    return campaign;
  }
  return {
    ...campaign,
    claimable: false,
    claimedToday: true,
    nextEligibleAt: onChainNextEligibleAtIso,
  };
}

export function formatShareRewardCountdown(
  iso: string,
  nowMs = Date.now(),
): string {
  const next = Date.parse(iso);
  if (!Number.isFinite(next)) {
    return "soon";
  }
  const delta = Math.max(0, next - nowMs);
  const minutes = Math.ceil(delta / 60_000);
  const hours = Math.floor(minutes / 60);
  if (hours >= 1) {
    return `${hours}h ${minutes % 60}m`;
  }
  return `${Math.max(1, minutes)}m`;
}
