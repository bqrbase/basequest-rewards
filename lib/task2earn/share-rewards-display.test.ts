import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { finalizeShareRewardsCampaign } from "./share-rewards-pending-gate.ts";

const WALLET = "0x2222222222222222222222222222222222222222";
const FID = 368591;
const CAST_A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const NOW = "2026-08-27T12:00:00.000Z";
const DAY_MS = 24 * 60 * 60 * 1000;

function pendingCampaign() {
  return {
    claimable: true,
    claimedToday: false,
    nextEligibleAt: null as string | null,
    claimFid: FID as number | null,
    claimCastHash: CAST_A as string | null,
    qualifiedWallet: WALLET as string | null,
  };
}

describe("production pending claim cannot resurrect", () => {
  const now = Date.parse(NOW);

  it("old pending claim + cooldown expired => not claimable", () => {
    const expired = new Date(now - 1).toISOString();
    const next = finalizeShareRewardsCampaign(pendingCampaign(), {
      onChainNextEligibleAt: expired,
      claimIdUsed: true,
      claimIdAuthorized: false,
      requireAuthorization: true,
      nowMs: now,
    });
    assert.equal(next.claimedToday, false);
    assert.equal(next.claimable, false);
    assert.equal(next.claimFid, null);
    assert.equal(next.claimCastHash, null);
    assert.equal(next.qualifiedWallet, null);
  });

  it("old pending claim + isClaimIdUsed => not claimable", () => {
    const next = finalizeShareRewardsCampaign(pendingCampaign(), {
      onChainNextEligibleAt: null,
      claimIdUsed: true,
      claimIdAuthorized: false,
      requireAuthorization: true,
      nowMs: now,
    });
    assert.equal(next.claimable, false);
    assert.equal(next.claimFid, null);
    assert.equal(next.claimCastHash, null);
    assert.equal(next.qualifiedWallet, null);
  });

  it("pending claim + !isAuthorized => not claimable", () => {
    const next = finalizeShareRewardsCampaign(pendingCampaign(), {
      onChainNextEligibleAt: null,
      claimIdUsed: false,
      claimIdAuthorized: false,
      requireAuthorization: true,
      nowMs: now,
    });
    assert.equal(next.claimable, false);
    assert.equal(next.claimedToday, false);
  });

  it("new authorized pending claim => claimable", () => {
    const next = finalizeShareRewardsCampaign(pendingCampaign(), {
      onChainNextEligibleAt: null,
      claimIdUsed: false,
      claimIdAuthorized: true,
      requireAuthorization: true,
      nowMs: now,
    });
    assert.equal(next.claimable, true);
    assert.equal(next.claimedToday, false);
    assert.equal(next.claimFid, FID);
    assert.equal(next.claimCastHash, CAST_A);
    assert.equal(next.qualifiedWallet, WALLET);
  });

  it("cooldown active => claimedToday true and claimable false", () => {
    const nextEligibleAt = new Date(now + DAY_MS).toISOString();
    const next = finalizeShareRewardsCampaign(pendingCampaign(), {
      onChainNextEligibleAt: nextEligibleAt,
      claimIdUsed: false,
      claimIdAuthorized: true,
      requireAuthorization: true,
      nowMs: now,
    });
    assert.equal(next.claimedToday, true);
    assert.equal(next.claimable, false);
    assert.equal(next.nextEligibleAt, nextEligibleAt);
  });
});
