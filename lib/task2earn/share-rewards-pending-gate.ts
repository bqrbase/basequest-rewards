/**
 * Pure pending-claim eligibility for BQR Share Rewards.
 * No RPC, database, or Next path aliases — safe for node:test.
 */

export type ShareRewardsPendingCampaign = {
  claimable: boolean;
  claimedToday: boolean;
  nextEligibleAt: string | null;
  claimFid: number | null;
  claimCastHash: string | null;
  qualifiedWallet: string | null;
};

export type SharePoolPendingClaimOnChain = {
  /** `isClaimIdUsed(claimId)`. null means the read failed. */
  used: boolean | null;
  /** Production `isAuthorized(claimId)`. null when unread, failed, or not required. */
  authorized: boolean | null;
  /** Production pool requires a live Authorized state. TEST pool does not. */
  requireAuthorization: boolean;
};

function suppressPendingIdentity<T extends ShareRewardsPendingCampaign>(
  campaign: T,
): T {
  return {
    ...campaign,
    claimable: false,
    claimFid: null,
    claimCastHash: null,
    qualifiedWallet: null,
  };
}

function applyFidCooldown<T extends ShareRewardsPendingCampaign>(
  campaign: T,
  onChainNextEligibleAtIso: string | null,
  nowMs: number,
): T {
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

/**
 * Pending ledger rows must not resurrect Claim after the share was consumed,
 * and production Claim is shown only for a live unconsumed authorization.
 * Consumed claimIds clear identity fields so the CTA returns to Share.
 * Unauthorized unused rows keep identity so Verify can still call authorize().
 */
export function applySharePoolPendingClaimGate<T extends ShareRewardsPendingCampaign>(
  campaign: T,
  onChain: SharePoolPendingClaimOnChain,
): T {
  const hasPendingIdentity = Boolean(
    campaign.claimFid && campaign.claimCastHash && campaign.qualifiedWallet,
  );
  if (!campaign.claimable && !hasPendingIdentity) {
    return campaign;
  }
  if (onChain.used === true) {
    return suppressPendingIdentity(campaign);
  }
  const authorizedOnProduction =
    !onChain.requireAuthorization || onChain.authorized === true;
  const unconsumed = onChain.used === false;
  if (unconsumed && authorizedOnProduction) {
    return campaign;
  }
  return {
    ...campaign,
    claimable: false,
  };
}

/** Apply on-chain FID cooldown, then the pending claimId gate. */
export function finalizeShareRewardsCampaign<T extends ShareRewardsPendingCampaign>(
  campaign: T,
  params: {
    onChainNextEligibleAt: string | null;
    claimIdUsed: boolean | null;
    claimIdAuthorized: boolean | null;
    requireAuthorization: boolean;
    nowMs?: number;
  },
): T {
  const cooled = applyFidCooldown(
    campaign,
    params.onChainNextEligibleAt,
    params.nowMs ?? Date.now(),
  );
  return applySharePoolPendingClaimGate(cooled, {
    used: params.claimIdUsed,
    authorized: params.claimIdAuthorized,
    requireAuthorization: params.requireAuthorization,
  });
}
