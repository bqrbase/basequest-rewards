import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { pad, toFunctionSelector } from "viem";

import {
  BQR_SHARE_REWARDS_POOL_PRODUCTION_ADDRESS,
  BQR_SHARE_REWARDS_POOL_TEST_ADDRESS,
  getBqrShareRewardsPoolAddress,
  getBqrShareRewardsPoolTestAddress,
  isFarcasterMiniAppShareWallet,
  isSharePoolClaimProductionEnabled,
  resolveShareRewardsClaimPoolAddress,
  toSharePoolCastHash,
} from "../contracts/shareRewardsPool.ts";
import { BQR_SHARE_REWARDS_POOL_ABI } from "../contracts/abi/BqrShareRewardsPool.ts";
import type { T2eRewardLedgerRow } from "./db.ts";
import {
  decideLedgerAfterClaimReceipt,
  fidCooldownActive,
  sameClaimReplay,
  SHARE_POOL_PAYOUT_WEI,
  sharePoolClaimKey,
  walletsMatch,
} from "./share-pool-flow.ts";
import {
  isSharePoolQualifyEnabled,
  qualifyVerifiedShare,
} from "./share-pool-qualify.ts";
import {
  buildStandaloneLedgerInsert,
  decideStandaloneShareCredit,
} from "./share-reward-logic.ts";
import { SHARE_CAST_MAX_AGE_MS } from "./constants.ts";
import {
  applyOnChainShareRewardCooldown,
  buildShareRewardsCampaign,
  campaignAfterSuccessfulClaim,
} from "./share-rewards-display.ts";

const WALLET = "0x2222222222222222222222222222222222222222";
const OTHER = "0x3333333333333333333333333333333333333333";
const FID = 368591;
const CAST_A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const CAST_B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const NOW = "2026-08-27T12:00:00.000Z";
const TX = "0x1111111111111111111111111111111111111111111111111111111111111111";

function pendingRow(): T2eRewardLedgerRow {
  const row = buildStandaloneLedgerInsert({
    fid: FID,
    walletAddress: WALLET,
    castHash: CAST_A,
    creditedAtIso: NOW,
  });
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    created_at: NOW,
    ...row,
  };
}

describe("verify then qualify then claim", () => {
  it("keeps the ledger pending until a successful 25 BQR receipt", () => {
    const decided = decideStandaloneShareCredit([], {
      fid: FID,
      walletAddress: WALLET,
      castHash: CAST_A,
      creditedAtIso: NOW,
    });
    assert.equal(decided.ok && !decided.alreadyClaimed, true);
    if (!decided.ok || decided.alreadyClaimed) {
      return;
    }
    assert.equal(decided.row.status, "pending");
    assert.equal(decided.row.tx_hash, null);
    assert.equal(decided.row.amount_bqr, 25);

    const beforeReceipt = decideLedgerAfterClaimReceipt({
      connectedWallet: WALLET,
      qualifiedWallet: WALLET,
      pending: {
        ...decided.row,
        status: "pending",
        tx_hash: null,
        wallet_address: WALLET,
        amount_bqr: 25,
      },
      receipt: null,
    });
    assert.equal(beforeReceipt.ok, false);
    if (!beforeReceipt.ok) {
      assert.equal(beforeReceipt.markPaid, false);
      assert.equal(beforeReceipt.error, "receipt_reverted");
    }

    const paid = decideLedgerAfterClaimReceipt({
      connectedWallet: WALLET,
      qualifiedWallet: WALLET,
      pending: pendingRow(),
      receipt: {
        status: "success",
        account: WALLET,
        fid: BigInt(FID),
        castHash: toSharePoolCastHash(CAST_A),
        amountWei: SHARE_POOL_PAYOUT_WEI,
        txHash: TX,
      },
    });
    assert.equal(paid.ok && paid.markPaid, true);
    if (paid.ok && paid.markPaid) {
      assert.equal(paid.amountBqr, 25);
      assert.equal(paid.txHash, TX);
      assert.equal(paid.status, "credited");
    }
  });
});

describe("wrong wallet cannot claim", () => {
  it("rejects a connected wallet that is not the verified wallet", () => {
    assert.equal(walletsMatch(OTHER, WALLET), false);
    const decision = decideLedgerAfterClaimReceipt({
      connectedWallet: OTHER,
      qualifiedWallet: WALLET,
      pending: pendingRow(),
      receipt: {
        status: "success",
        account: OTHER,
        fid: BigInt(FID),
        castHash: toSharePoolCastHash(CAST_A),
        amountWei: SHARE_POOL_PAYOUT_WEI,
        txHash: TX,
      },
    });
    assert.equal(decision.ok, false);
    if (!decision.ok) {
      assert.equal(decision.error, "wrong_wallet");
      assert.equal(decision.markPaid, false);
    }
  });
});

describe("same claim cannot be claimed twice", () => {
  it("treats a used claim key as a replay", () => {
    const key = sharePoolClaimKey({
      account: WALLET,
      fid: FID,
      castHash: CAST_A,
    });
    const used = new Set([key]);
    assert.equal(sameClaimReplay(used, key), true);
    assert.equal(
      sameClaimReplay(
        used,
        sharePoolClaimKey({ account: WALLET, fid: FID, castHash: CAST_B }),
      ),
      false,
    );
    const already = decideLedgerAfterClaimReceipt({
      connectedWallet: WALLET,
      qualifiedWallet: WALLET,
      pending: { ...pendingRow(), status: "credited", tx_hash: TX },
      receipt: {
        status: "success",
        account: WALLET,
        fid: BigInt(FID),
        castHash: toSharePoolCastHash(CAST_A),
        amountWei: SHARE_POOL_PAYOUT_WEI,
        txHash: TX,
      },
    });
    assert.equal(already.ok && !already.markPaid, true);
  });
});

describe("same FID 24h cooldown", () => {
  it("blocks another claim for the same FID within 24 hours", () => {
    const last = Date.parse(NOW);
    assert.equal(fidCooldownActive(last, last + 60_000), true);
    assert.equal(
      fidCooldownActive(last, last + SHARE_CAST_MAX_AGE_MS + 1),
      false,
    );
  });
});

describe("payout amount", () => {
  it("requires exactly 25e18 BQR before marking paid", () => {
    const wrong = decideLedgerAfterClaimReceipt({
      connectedWallet: WALLET,
      qualifiedWallet: WALLET,
      pending: pendingRow(),
      receipt: {
        status: "success",
        account: WALLET,
        fid: BigInt(FID),
        castHash: toSharePoolCastHash(CAST_A),
        amountWei: 24n * 10n ** 18n,
        txHash: TX,
      },
    });
    assert.equal(wrong.ok, false);
    if (!wrong.ok) {
      assert.equal(wrong.error, "amount_mismatch");
      assert.equal(wrong.markPaid, false);
    }
  });
});

describe("post-claim campaign UI", () => {
  it("marks claimed immediately after a successful 25 BQR receipt", () => {
    const before = buildShareRewardsCampaign({
      creditedPoolBqr: 0,
      earnedBqr: 0,
      lastCreditedAt: null,
      poolRemainingBqr: 1000,
      claimable: true,
      claimFid: FID,
      claimCastHash: CAST_A,
      qualifiedWallet: WALLET,
    });
    assert.equal(before.claimable, true);
    const now = Date.parse(NOW);
    const after = campaignAfterSuccessfulClaim(before, now);
    assert.equal(after.claimable, false);
    assert.equal(after.claimedToday, true);
    assert.equal(
      after.nextEligibleAt,
      new Date(now + SHARE_CAST_MAX_AGE_MS).toISOString(),
    );
    assert.equal(after.poolRemainingBqr, 975);
    assert.equal(after.claimFid, null);
    assert.equal(after.claimPoolAddress, before.claimPoolAddress);
  });

  it("hides Claim when on-chain FID cooldown is active even if a pending row remains", () => {
    const pending = buildShareRewardsCampaign({
      creditedPoolBqr: 0,
      earnedBqr: 0,
      lastCreditedAt: null,
      poolRemainingBqr: 975,
      claimable: true,
      claimFid: FID,
      claimCastHash: CAST_A,
      qualifiedWallet: WALLET,
    });
    const now = Date.parse(NOW);
    const nextEligibleAt = new Date(now + SHARE_CAST_MAX_AGE_MS).toISOString();
    const synced = applyOnChainShareRewardCooldown(
      pending,
      nextEligibleAt,
      now,
    );
    assert.equal(synced.claimable, false);
    assert.equal(synced.claimedToday, true);
    assert.equal(synced.nextEligibleAt, nextEligibleAt);
  });

  it("does not hide Claim after the on-chain cooldown has expired", () => {
    const pending = buildShareRewardsCampaign({
      creditedPoolBqr: 0,
      earnedBqr: 0,
      lastCreditedAt: null,
      poolRemainingBqr: 975,
      claimable: true,
      claimFid: FID,
      claimCastHash: CAST_A,
      qualifiedWallet: WALLET,
    });
    const now = Date.parse(NOW);
    const expired = new Date(now - 1).toISOString();
    const synced = applyOnChainShareRewardCooldown(pending, expired, now);
    assert.equal(synced.claimable, true);
    assert.equal(synced.claimedToday, false);
  });
});

describe("failed claim stays unpaid", () => {
  it("does not mark paid when the receipt reverted", () => {
    const decision = decideLedgerAfterClaimReceipt({
      connectedWallet: WALLET,
      qualifiedWallet: WALLET,
      pending: pendingRow(),
      receipt: {
        status: "reverted",
        account: WALLET,
        fid: BigInt(FID),
        castHash: toSharePoolCastHash(CAST_A),
        amountWei: SHARE_POOL_PAYOUT_WEI,
        txHash: TX,
      },
    });
    assert.equal(decision.ok, false);
    if (!decision.ok) {
      assert.equal(decision.markPaid, false);
      assert.equal(decision.error, "receipt_reverted");
    }
  });
});

describe("qualifyShare guard", () => {
  it("does not send a transaction unless the owner key is present", async () => {
    assert.equal(isSharePoolQualifyEnabled({}), false);
    assert.equal(
      isSharePoolQualifyEnabled({
        BQR_SHARE_POOL_OWNER_PRIVATE_KEY: "0x01",
      } as NodeJS.ProcessEnv),
      false,
    );
    assert.equal(
      isSharePoolQualifyEnabled({
        BQR_SHARE_POOL_QUALIFY_ENABLED: "false",
        BQR_SHARE_POOL_OWNER_PRIVATE_KEY: "0x01",
      } as NodeJS.ProcessEnv),
      false,
    );
    const skipped = await qualifyVerifiedShare(
      { account: WALLET, fid: FID, castHash: CAST_A },
      { enabled: false },
    );
    assert.equal(skipped.ok, true);
    if (skipped.ok) {
      assert.equal(skipped.skipped, true);
      assert.equal(skipped.txHash, null);
      assert.equal(skipped.reason, "qualify_disabled");
    }
  });

  it("skips when the owner key is missing even if enabled", async () => {
    const skipped = await qualifyVerifiedShare(
      { account: WALLET, fid: FID, castHash: CAST_A },
      {
        enabled: true,
        env: {
          BQR_SHARE_POOL_QUALIFY_ENABLED: "true",
        } as NodeJS.ProcessEnv,
      },
    );
    assert.equal(skipped.ok, true);
    if (skipped.ok) {
      assert.equal(skipped.skipped, true);
      assert.equal(skipped.txHash, null);
      assert.equal(skipped.reason, "owner_key_missing");
    }
  });

  it("refuses a signer that is not the pinned pool owner", async () => {
    const result = await qualifyVerifiedShare(
      { account: WALLET, fid: FID, castHash: CAST_A },
      {
        enabled: true,
        env: {
          BQR_SHARE_POOL_QUALIFY_ENABLED: "true",
          BQR_SHARE_POOL_OWNER_PRIVATE_KEY:
            "0x0000000000000000000000000000000000000000000000000000000000000001",
        } as NodeJS.ProcessEnv,
      },
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /0xD34f706D5a5567FC0d45eFFa1623a37B66Ea41a2/i);
      assert.doesNotMatch(result.error, /0x1819171c76D4B993ae6f14f43381b1Dfcd2AA09f/i);
    }
  });

  it("calls qualifyShare without transferring BQR when a write stub is provided", async () => {
    let called = 0;
    const result = await qualifyVerifiedShare(
      { account: WALLET, fid: FID, castHash: CAST_A },
      {
        enabled: true,
        writeQualifyShare: async () => {
          called += 1;
          return TX;
        },
      },
    );
    assert.equal(called, 1);
    assert.equal(result.ok && !result.skipped, true);
  });
});

describe("Farcaster Mini App claim wallet", () => {
  it("accepts only the Farcaster Mini App connector", () => {
    assert.equal(
      isFarcasterMiniAppShareWallet({ id: "farcaster", type: "farcasterMiniApp" }),
      true,
    );
    assert.equal(
      isFarcasterMiniAppShareWallet({ id: "farcaster", type: "farcasterFrame" }),
      true,
    );
    assert.equal(isFarcasterMiniAppShareWallet(null), false);
    assert.equal(
      isFarcasterMiniAppShareWallet({ id: "baseAccount", type: "baseAccount" }),
      false,
    );
    assert.equal(
      isFarcasterMiniAppShareWallet({
        id: "coinbaseWalletSDK",
        type: "coinbaseWalletSDK",
      }),
      false,
    );
    assert.equal(
      isFarcasterMiniAppShareWallet({ id: "injected", type: "injected" }),
      false,
    );
    assert.equal(
      isFarcasterMiniAppShareWallet({ id: "walletConnect", type: "walletConnect" }),
      false,
    );
  });
});

describe("cast hash encoding", () => {
  it("left-pads a 20-byte Farcaster hash to bytes32", () => {
    assert.equal(toSharePoolCastHash(CAST_A), pad(CAST_A, { size: 32 }));
  });
});

describe("Share Rewards claim pool resolution", () => {
  const PRODUCTION = BQR_SHARE_REWARDS_POOL_PRODUCTION_ADDRESS;
  const TEST = BQR_SHARE_REWARDS_POOL_TEST_ADDRESS;

  it("defaults to the TEST-ONLY pool when production claim cutover is disabled", () => {
    const resolved = resolveShareRewardsClaimPoolAddress({});
    assert.equal(resolved, TEST);
    assert.equal(getBqrShareRewardsPoolAddress({}), TEST);
    assert.equal(getBqrShareRewardsPoolTestAddress(), TEST);
    assert.notEqual(resolved, "0x967EdCDcf74d6793F1c6d09a1056ec66481513cB");
  });

  it("resolves production pool for controlled cutover env", () => {
    const env = {
      BQR_SHARE_POOL_CLAIM_PRODUCTION_ENABLED: "true",
      BQR_SHARE_REWARDS_POOL_PRODUCTION: PRODUCTION,
    } as NodeJS.ProcessEnv;
    assert.equal(isSharePoolClaimProductionEnabled(env), true);
    assert.equal(resolveShareRewardsClaimPoolAddress(env), PRODUCTION);
  });

  it("keeps TEST fallback when production claim flag is off even if production env is set", () => {
    const env = {
      BQR_SHARE_REWARDS_POOL_PRODUCTION: PRODUCTION,
    } as NodeJS.ProcessEnv;
    assert.equal(isSharePoolClaimProductionEnabled(env), false);
    assert.equal(resolveShareRewardsClaimPoolAddress(env), TEST);
  });

  it("prefers NEXT_PUBLIC override over server production claim flag", () => {
    const env = {
      NEXT_PUBLIC_BQR_SHARE_REWARDS_POOL: TEST,
      BQR_SHARE_POOL_CLAIM_PRODUCTION_ENABLED: "true",
      BQR_SHARE_REWARDS_POOL_PRODUCTION: PRODUCTION,
    } as NodeJS.ProcessEnv;
    assert.equal(resolveShareRewardsClaimPoolAddress(env), TEST);
  });

  it("keeps claim ABI claim(uint256,bytes32) unchanged", () => {
    const claim = BQR_SHARE_REWARDS_POOL_ABI.find(
      (item) => item.type === "function" && item.name === "claim",
    );
    assert.ok(claim && claim.type === "function");
    assert.deepEqual(claim.inputs, [
      { name: "fid", type: "uint256", internalType: "uint256" },
      { name: "castHash", type: "bytes32", internalType: "bytes32" },
    ]);
    assert.equal(
      toFunctionSelector("claim(uint256,bytes32)"),
      toFunctionSelector("claim(uint256,bytes32)"),
    );
  });
});

describe("RewardsDistributor isolation", () => {
  it("does not reuse Merkle claim ids, selector, or the distributor address", () => {
    const row = buildStandaloneLedgerInsert({
      fid: FID,
      walletAddress: WALLET,
      castHash: CAST_A,
      creditedAtIso: NOW,
    });
    assert.match(row.claim_id, /^share_rewards:/);
    assert.doesNotMatch(row.claim_id, /^share_cast:/);
    assert.notEqual(
      toFunctionSelector("claim(uint256,bytes32)"),
      toFunctionSelector("claim(uint256,bytes32,uint256,bytes32[])"),
    );
    assert.notEqual(
      row.claim_id.includes("0x8DB0F6a276242787f8DA48360898cC3B5FC0bCe9"),
      true,
    );
  });
});
