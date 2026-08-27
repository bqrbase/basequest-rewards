import {
  BQR_SHARE_REWARDS_POOL_BQR,
  SHARE_CAST_MAX_AGE_MS,
  SHARE_CAST_REWARD_BQR,
} from "./constants";

/** Configured off-chain BQR Share Rewards pool. Not an on-chain balance. */
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

export function buildShareRewardsCampaign(params: {
  creditedPoolBqr: number;
  earnedBqr: number;
  lastCreditedAt: string | null;
  nowMs?: number;
}): ShareRewardsCampaign {
  const nowMs = params.nowMs ?? Date.now();
  const poolRemainingBqr = remainingShareRewardsPool(params.creditedPoolBqr);
  const nextEligibleAt = nextShareRewardEligibleAt(params.lastCreditedAt, nowMs);
  return {
    poolConfiguredBqr: BQR_SHARE_REWARDS_POOL_BQR,
    poolRemainingBqr,
    dailyRewardBqr: SHARE_CAST_REWARD_BQR,
    live: isShareRewardsLive(poolRemainingBqr),
    earnedBqr: params.earnedBqr,
    lastCreditedAt: params.lastCreditedAt,
    nextEligibleAt,
    claimedToday: Boolean(nextEligibleAt),
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
