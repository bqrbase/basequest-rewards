import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getAddress, pad } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import {
  applySharePoolAuthorizationToCampaign,
  assertSharePoolOperatorKey,
  authorizeVerifiedShare,
  BQR_SHARE_POOL_OPERATOR_ADDRESS,
  encodeSharePoolAuthorizeCall,
  getBqrShareRewardsPoolProductionAddress,
  isSharePoolAuthorizeEnabled,
  redactSharePoolSecrets,
  SHARE_POOL_AUTHORIZE_ABI,
  SHARE_POOL_AUTHORIZE_FUNCTION,
  shouldAuthorizeVerifiedShare,
  sharePoolAuthorizeWriteFunctions,
} from "./share-pool-authorize.ts";
import { buildShareRewardsCampaign } from "./share-rewards-display.ts";
import { evaluateShareCastProof } from "./share-verify.ts";
import { canonicalShareRewardsUrl } from "../miniapp/share.ts";
import { isFarcasterMiniAppShareWallet } from "../contracts/shareRewardsPool.ts";

const WALLET = "0x2222222222222222222222222222222222222222";
const FID = 368591;
const CAST_A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const TX =
  "0x1111111111111111111111111111111111111111111111111111111111111111";
const PRODUCTION_POOL = "0x1234567890123456789012345678901234567890";
const OPERATOR_KEY =
  "0x0000000000000000000000000000000000000000000000000000000000000001";

function claimableCampaign() {
  return buildShareRewardsCampaign({
    creditedPoolBqr: 0,
    earnedBqr: 0,
    lastCreditedAt: null,
    claimable: true,
    claimFid: FID,
    claimCastHash: CAST_A,
    qualifiedWallet: WALLET,
  });
}

function productionEnv(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    BQR_SHARE_POOL_AUTHORIZE_ENABLED: "true",
    BQR_SHARE_REWARDS_POOL_PRODUCTION: PRODUCTION_POOL,
    BQR_SHARE_POOL_OPERATOR_PRIVATE_KEY: OPERATOR_KEY,
    ...overrides,
  } as NodeJS.ProcessEnv;
}

describe("share pool authorize ABI surface", () => {
  it("exposes only authorize as a write function", () => {
    assert.deepEqual(sharePoolAuthorizeWriteFunctions(), ["authorize"]);
    const writeNames = SHARE_POOL_AUTHORIZE_ABI.filter(
      (item) => item.type === "function" && item.stateMutability === "nonpayable",
    ).map((item) => item.name);
    assert.deepEqual(writeNames, ["authorize"]);
    assert.equal(SHARE_POOL_AUTHORIZE_FUNCTION, "authorize");
    assert.equal(
      writeNames.includes("fund") ||
        writeNames.includes("pause") ||
        writeNames.includes("withdrawUnusedBqr") ||
        writeNames.includes("transferOwnership"),
      false,
    );
  });

  it("encodes authorize(account, fid, castHash) only", () => {
    const data = encodeSharePoolAuthorizeCall({
      account: getAddress(WALLET),
      fid: BigInt(FID),
      castHash: pad(CAST_A, { size: 32 }),
    });
    assert.match(data, /^0x/);
    assert.equal(data.length, 2 + 8 + 64 * 3);
  });
});

describe("shouldAuthorizeVerifiedShare", () => {
  it("never authorizes invalid Neynar proofs", () => {
    for (const reason of [
      "reply",
      "recast_or_quote",
      "wrong_task_url",
      "stale_cast",
      "missing_cast",
    ] as const) {
      const decision = shouldAuthorizeVerifiedShare({
        proofOk: false,
        proofReason: reason,
        alreadyClaimable: false,
        claimedToday: false,
        cooldownActive: false,
        poolLive: true,
        ledgerInserted: true,
        ledgerDuplicate: false,
      });
      assert.equal(decision.authorize, false);
      assert.equal(decision.reason, reason);
    }
  });

  it("never authorizes cooldown, depletion, or ledger failures", () => {
    assert.equal(
      shouldAuthorizeVerifiedShare({
        proofOk: true,
        alreadyClaimable: false,
        claimedToday: true,
        cooldownActive: false,
        poolLive: true,
        ledgerInserted: true,
        ledgerDuplicate: false,
      }).authorize,
      false,
    );
    assert.equal(
      shouldAuthorizeVerifiedShare({
        proofOk: true,
        alreadyClaimable: false,
        claimedToday: false,
        cooldownActive: true,
        poolLive: true,
        ledgerInserted: true,
        ledgerDuplicate: false,
      }).reason,
      "cooldown",
    );
    assert.equal(
      shouldAuthorizeVerifiedShare({
        proofOk: true,
        alreadyClaimable: false,
        claimedToday: false,
        cooldownActive: false,
        poolLive: false,
        ledgerInserted: true,
        ledgerDuplicate: false,
      }).reason,
      "pool_depleted",
    );
  });

  it("requires authorization after a fresh ledger insert", () => {
    const decision = shouldAuthorizeVerifiedShare({
      proofOk: true,
      alreadyClaimable: false,
      claimedToday: false,
      cooldownActive: false,
      poolLive: true,
      ledgerInserted: true,
      ledgerDuplicate: false,
    });
    assert.equal(decision.authorize, true);
    assert.equal(decision.mode, "required");
  });

  it("uses idempotent authorization for duplicate or already-claimable rows", () => {
    for (const input of [
      {
        alreadyClaimable: true,
        ledgerDuplicate: false,
        ledgerInserted: true,
      },
      {
        alreadyClaimable: false,
        ledgerDuplicate: true,
        ledgerInserted: true,
      },
    ]) {
      const decision = shouldAuthorizeVerifiedShare({
        proofOk: true,
        claimedToday: false,
        cooldownActive: false,
        poolLive: true,
        ledgerConflict: "duplicate",
        ...input,
      });
      assert.equal(decision.authorize, true);
      assert.equal(decision.mode, "idempotent");
    }
  });
});

describe("Neynar proof gates authorization", () => {
  it("accepts a valid /tasks/me share and rejects reply proofs", () => {
    const url = canonicalShareRewardsUrl();
    const nowMs = Date.parse("2026-08-27T12:00:00.000Z");
    const rules = {
      expectedFid: FID,
      taskUrl: url,
      taskCreatedAtMs: 0,
      nowMs,
    };
    const validCast = {
      hash: CAST_A,
      authorFid: FID,
      timestampMs: nowMs - 60_000,
      text: "Share Rewards",
      parentHash: null,
      embedUrls: [url],
      hasQuotedCast: false,
      isRecast: false,
    };
    assert.equal(evaluateShareCastProof(validCast, rules), "valid");
    assert.equal(
      shouldAuthorizeVerifiedShare({
        proofOk: true,
        alreadyClaimable: false,
        claimedToday: false,
        cooldownActive: false,
        poolLive: true,
        ledgerInserted: true,
        ledgerDuplicate: false,
      }).authorize,
      true,
    );

    const replyReason = evaluateShareCastProof(
      { ...validCast, parentHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
      rules,
    );
    assert.equal(replyReason, "reply");
    assert.equal(
      shouldAuthorizeVerifiedShare({
        proofOk: false,
        proofReason: replyReason,
        alreadyClaimable: false,
        claimedToday: false,
        cooldownActive: false,
        poolLive: true,
        ledgerInserted: true,
        ledgerDuplicate: false,
      }).authorize,
      false,
    );

    const staleReason = evaluateShareCastProof(
      { ...validCast, timestampMs: nowMs - 25 * 60 * 60 * 1000 },
      rules,
    );
    assert.equal(staleReason, "stale_cast");
    assert.equal(
      shouldAuthorizeVerifiedShare({
        proofOk: false,
        proofReason: staleReason,
        alreadyClaimable: false,
        claimedToday: false,
        cooldownActive: false,
        poolLive: true,
        ledgerInserted: true,
        ledgerDuplicate: false,
      }).authorize,
      false,
    );
  });
});

describe("authorizeVerifiedShare", () => {
  it("is inactive until production pool address and flag are configured", async () => {
    assert.equal(isSharePoolAuthorizeEnabled({}), false);
    assert.equal(
      isSharePoolAuthorizeEnabled({
        BQR_SHARE_POOL_AUTHORIZE_ENABLED: "true",
      } as NodeJS.ProcessEnv),
      false,
    );
    assert.equal(getBqrShareRewardsPoolProductionAddress({}), null);

    const skipped = await authorizeVerifiedShare(
      { account: WALLET, fid: FID, castHash: CAST_A },
      { enabled: false },
    );
    assert.equal(skipped.ok, true);
    if (skipped.ok) {
      assert.equal(skipped.skipped, true);
      assert.equal(skipped.reason, "authorize_disabled");
      assert.equal(skipped.txHash, null);
    }
  });

  it("refuses treasury, deployer, TEST, and old-live pool addresses", () => {
    for (const forbidden of [
      "0x75b99B36DDc4206A3c3A5d89436606e637003151",
      "0x967EdCDcf74d6793F1c6d09a1056ec66481513cB",
      "0xD34f706D5a5567FC0d45eFFa1623a37B66Ea41a2",
      BQR_SHARE_POOL_OPERATOR_ADDRESS,
    ]) {
      assert.throws(
        () =>
          getBqrShareRewardsPoolProductionAddress({
            BQR_SHARE_REWARDS_POOL_PRODUCTION: forbidden,
          } as NodeJS.ProcessEnv),
        /production_pool_address_forbidden/,
      );
    }
  });

  it("calls authorize via write stub after valid verification path", async () => {
    let called = 0;
    const result = await authorizeVerifiedShare(
      { account: WALLET, fid: FID, castHash: CAST_A },
      {
        enabled: true,
        env: productionEnv(),
        writeAuthorize: async () => {
          called += 1;
          return TX;
        },
      },
    );
    assert.equal(called, 1);
    assert.equal(result.ok && !result.skipped, true);
    if (result.ok && !result.skipped) {
      assert.equal(result.txHash, TX);
    }
  });

  it("skips a second broadcast when already authorized on-chain", async () => {
    let called = 0;
    const result = await authorizeVerifiedShare(
      { account: WALLET, fid: FID, castHash: CAST_A },
      {
        enabled: true,
        env: productionEnv(),
        readIsAuthorized: async () => true,
        writeAuthorize: async () => {
          called += 1;
          return TX;
        },
      },
    );
    assert.equal(called, 0);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.skipped, true);
      assert.equal(result.reason, "already_authorized");
    }
  });

  it("treats AlreadyAuthorized reverts as idempotent success", async () => {
    const result = await authorizeVerifiedShare(
      { account: WALLET, fid: FID, castHash: CAST_A },
      {
        enabled: true,
        env: productionEnv(),
        writeAuthorize: async () => {
          throw new Error("execution reverted: AlreadyAuthorized()");
        },
      },
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.skipped, true);
      assert.equal(result.reason, "already_authorized");
    }
  });

  it("refuses a signer that is not the dedicated operator", async () => {
    const wrong = privateKeyToAccount(OPERATOR_KEY);
    assert.notEqual(
      getAddress(wrong.address),
      getAddress(BQR_SHARE_POOL_OPERATOR_ADDRESS),
    );
    assert.throws(
      () => assertSharePoolOperatorKey({ derivedAddress: wrong.address }),
      /0x058A6B143B622aEAA876A6529969B2F97541e927/i,
    );

    const result = await authorizeVerifiedShare(
      { account: WALLET, fid: FID, castHash: CAST_A },
      {
        enabled: true,
        env: productionEnv(),
      },
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /0x058A6B143B622aEAA876A6529969B2F97541e927/i);
    }
  });

  it("never logs raw private keys", () => {
    const secret =
      "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd";
    const redacted = redactSharePoolSecrets(
      `authorize failed for key ${secret} on ${secret}`,
    );
    assert.doesNotMatch(redacted, /abcdefabcdefabcdefabcdefabcdef/i);
    assert.match(redacted, /\[redacted\]/g);
  });
});

describe("applySharePoolAuthorizationToCampaign", () => {
  it("keeps TEST claimable when production authorize is disabled", () => {
    const campaign = claimableCampaign();
    const applied = applySharePoolAuthorizationToCampaign(campaign, {
      ok: true,
      skipped: true,
      reason: "authorize_disabled",
      txHash: null,
    });
    assert.equal(applied.campaign.claimable, true);
    assert.equal(applied.qualifiedOnchain, false);
  });

  it("shows Claim only after authorization succeeds when production is active", () => {
    const campaign = claimableCampaign();
    const success = applySharePoolAuthorizationToCampaign(campaign, {
      ok: true,
      skipped: false,
      reason: "authorized",
      txHash: TX,
    });
    assert.equal(success.campaign.claimable, true);
    assert.equal(success.qualifiedOnchain, true);

    const gated = applySharePoolAuthorizationToCampaign(
      { ...campaign, claimable: false },
      {
        ok: true,
        skipped: false,
        reason: "authorized",
        txHash: TX,
      },
    );
    assert.equal(gated.campaign.claimable, true);
    assert.equal(gated.campaign.claimFid, FID);
    assert.equal(gated.qualifiedOnchain, true);

    const failure = applySharePoolAuthorizationToCampaign(campaign, {
      ok: false,
      skipped: false,
      error: "authorize_failed",
      txHash: null,
    });
    assert.equal(failure.campaign.claimable, false);
    assert.equal(failure.campaign.claimFid, null);
    assert.equal(failure.qualifiedOnchain, false);
  });
});

describe("Claim wallet and 24h rules unchanged", () => {
  it("accepts only the Farcaster Mini App connector", () => {
    assert.equal(
      isFarcasterMiniAppShareWallet({ id: "farcaster", type: "farcasterMiniApp" }),
      true,
    );
    assert.equal(
      isFarcasterMiniAppShareWallet({ id: "baseAccount", type: "baseAccount" }),
      false,
    );
  });

  it("still blocks authorization during FID cooldown decisions", () => {
    const decision = shouldAuthorizeVerifiedShare({
      proofOk: true,
      alreadyClaimable: false,
      claimedToday: false,
      cooldownActive: true,
      poolLive: true,
      ledgerInserted: true,
      ledgerDuplicate: false,
      ledgerConflict: "cooldown",
    });
    assert.equal(decision.authorize, false);
    assert.equal(decision.reason, "cooldown");
  });
});
