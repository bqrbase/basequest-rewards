import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BQR_SHARE_REWARDS_POOL_BQR,
  SHARE_CAST_MAX_AGE_MS,
  SHARE_CAST_REWARD_BQR,
  SHARE_REWARDS_REWARD_TYPE,
} from "./constants.ts";
import type { T2eRewardLedgerRow } from "./db.ts";
import {
  buildStandaloneLedgerInsert,
  classifyStandaloneLedgerInsertError,
  decideStandaloneShareCredit,
  existingCreditedShare,
  shareCastClaimId,
  shareRewardsClaimId,
  sumStandaloneCreditedBqr,
  standaloneCreditWindowsOverlap,
  wouldExceedStandalonePool,
} from "./share-reward-logic.ts";

const TASK_ID = "74ff717c-8124-475c-8ef4-031fd4b2b5c6";
const WALLET = "0x2222222222222222222222222222222222222222";
const OTHER_WALLET = "0x3333333333333333333333333333333333333333";
const FID = 368591;
const OTHER_FID = 111222;
const CAST_A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const CAST_B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const NOW = "2026-08-27T12:00:00.000Z";

function asLedger(
  row: ReturnType<typeof buildStandaloneLedgerInsert>,
  id: string,
): T2eRewardLedgerRow {
  return {
    id,
    claim_id: row.claim_id,
    wallet_address: row.wallet_address,
    fid: row.fid,
    reward_type: row.reward_type,
    source: row.source,
    reference_id: row.reference_id,
    amount_bqr: row.amount_bqr,
    status: row.status,
    cast_hash: row.cast_hash,
    share_id: row.share_id,
    created_at: row.credited_at,
    credited_at: row.credited_at,
    claimed_at: row.claimed_at,
    tx_hash: row.tx_hash,
  };
}

function taskShareCastRow(): T2eRewardLedgerRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    claim_id: shareCastClaimId(TASK_ID, FID),
    wallet_address: WALLET,
    fid: FID,
    reward_type: "share_cast",
    source: "farcaster_share",
    reference_id: TASK_ID,
    amount_bqr: 25,
    status: "credited",
    cast_hash: "0xcccccccccccccccccccccccccccccccccccccccc",
    share_id: "22222222-2222-4222-8222-222222222222",
    created_at: NOW,
    credited_at: NOW,
    claimed_at: null,
    tx_hash: null,
  };
}

describe("standalone first credit", () => {
  it("inserts one credited bqr_share_daily row for 25 BQR with null reference_id", () => {
    const decided = decideStandaloneShareCredit([], {
      fid: FID,
      walletAddress: WALLET,
      castHash: CAST_A,
      creditedAtIso: NOW,
    });
    assert.equal(decided.ok, true);
    if (!decided.ok || decided.alreadyClaimed) {
      throw new Error("expected a first credit");
    }
    assert.equal(decided.row.amount_bqr, 25);
    assert.equal(decided.row.reward_type, SHARE_REWARDS_REWARD_TYPE);
    assert.equal(decided.row.reference_id, null);
    assert.equal(decided.row.status, "credited");
    assert.equal(decided.row.share_id, null);
    assert.equal(decided.row.claimed_at, null);
    assert.equal(decided.row.tx_hash, null);
    assert.equal(decided.row.source, "farcaster_share");
    assert.equal(SHARE_CAST_REWARD_BQR, 25);
  });
});

describe("standalone cooldown", () => {
  it("rejects a second credit for the same FID within 24 hours", () => {
    const first = decideStandaloneShareCredit([], {
      fid: FID,
      walletAddress: WALLET,
      castHash: CAST_A,
      creditedAtIso: NOW,
    });
    assert.equal(first.ok && !first.alreadyClaimed, true);
    if (!first.ok || first.alreadyClaimed) {
      return;
    }
    const second = decideStandaloneShareCredit(
      [asLedger(first.row, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")],
      {
        fid: FID,
        walletAddress: WALLET,
        castHash: CAST_A,
        creditedAtIso: NOW,
      },
    );
    assert.equal(second.ok, true);
    if (second.ok) {
      assert.equal(second.alreadyClaimed, true);
    }
  });

  it("rejects a different Cast for the same FID within 24 hours", () => {
    const first = decideStandaloneShareCredit([], {
      fid: FID,
      walletAddress: WALLET,
      castHash: CAST_A,
      creditedAtIso: NOW,
    });
    if (!first.ok || first.alreadyClaimed) {
      throw new Error("expected a first credit");
    }
    const second = decideStandaloneShareCredit(
      [asLedger(first.row, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")],
      {
        fid: FID,
        walletAddress: WALLET,
        castHash: CAST_B,
        creditedAtIso: NOW,
      },
    );
    assert.equal(second.ok, true);
    if (second.ok) {
      assert.equal(second.alreadyClaimed, true);
    }
  });
});

describe("standalone different FID", () => {
  it("credits 25 BQR to a different FID", () => {
    const first = decideStandaloneShareCredit([], {
      fid: FID,
      walletAddress: WALLET,
      castHash: CAST_A,
      creditedAtIso: NOW,
    });
    if (!first.ok || first.alreadyClaimed) {
      throw new Error("expected a first credit");
    }
    const second = decideStandaloneShareCredit(
      [asLedger(first.row, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")],
      {
        fid: OTHER_FID,
        walletAddress: OTHER_WALLET,
        castHash: CAST_B,
        creditedAtIso: NOW,
      },
    );
    assert.equal(second.ok && !second.alreadyClaimed, true);
    if (second.ok && !second.alreadyClaimed) {
      assert.equal(second.row.amount_bqr, 25);
      assert.equal(second.row.fid, OTHER_FID);
    }
  });
});

describe("standalone pool calculation", () => {
  it("only counts bqr_share_daily credited rows against the 10,000 pool", () => {
    const standalone = buildStandaloneLedgerInsert({
      fid: FID,
      walletAddress: WALLET,
      castHash: CAST_A,
      creditedAtIso: NOW,
    });
    const credited = sumStandaloneCreditedBqr([
      asLedger(standalone, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
      taskShareCastRow(),
    ]);
    assert.equal(credited, 25);
    assert.equal(BQR_SHARE_REWARDS_POOL_BQR - credited, 9_975);
    assert.equal(BQR_SHARE_REWARDS_POOL_BQR, 10_000);
    assert.equal(sumStandaloneCreditedBqr([taskShareCastRow()]), 0);
    assert.equal(BQR_SHARE_REWARDS_POOL_BQR, 10_000);
  });
});

describe("task Share Cast regression", () => {
  it("keeps the existing share_cast claim_id helper unchanged", () => {
    assert.equal(
      shareCastClaimId(TASK_ID, FID),
      `share_cast:${TASK_ID}:${FID}`,
    );
  });

  it("does not treat a task share_cast row as a standalone credit", () => {
    const taskRow = taskShareCastRow();
    const existing = existingCreditedShare({
      claimId: taskRow.claim_id,
      taskId: TASK_ID,
      walletAddress: WALLET,
      fid: FID,
      ledgers: [taskRow],
    });
    assert.equal(existing?.alreadyCredited, true);
    const standalone = decideStandaloneShareCredit([taskRow], {
      fid: FID,
      walletAddress: WALLET,
      castHash: CAST_A,
      creditedAtIso: NOW,
    });
    assert.equal(standalone.ok && !standalone.alreadyClaimed, true);
  });
});

describe("duplicate cast", () => {
  it("cannot credit the same cast hash twice", () => {
    const first = decideStandaloneShareCredit([], {
      fid: FID,
      walletAddress: WALLET,
      castHash: CAST_A,
      creditedAtIso: NOW,
    });
    if (!first.ok || first.alreadyClaimed) {
      throw new Error("expected a first credit");
    }
    const second = decideStandaloneShareCredit(
      [asLedger(first.row, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")],
      {
        fid: OTHER_FID,
        walletAddress: OTHER_WALLET,
        castHash: CAST_A,
        creditedAtIso: NOW,
      },
    );
    assert.equal(second.ok, true);
    if (second.ok) {
      assert.equal(second.alreadyClaimed, true);
    }
  });
});

describe("standalone claim id", () => {
  it("uses share_rewards:{fid}:{normalizedCastHash}", () => {
    assert.equal(
      shareRewardsClaimId(FID, CAST_A),
      `share_rewards:${FID}:${CAST_A}`,
    );
    assert.equal(
      shareRewardsClaimId(FID, CAST_A.toUpperCase()),
      `share_rewards:${FID}:${CAST_A}`,
    );
    const row = buildStandaloneLedgerInsert({
      fid: FID,
      walletAddress: WALLET,
      castHash: CAST_A.toUpperCase(),
      creditedAtIso: NOW,
    });
    assert.equal(row.claim_id, `share_rewards:${FID}:${CAST_A}`);
  });
});

describe("24-hour race", () => {
  it("cannot create two credited rows for the same FID in overlapping windows", () => {
    assert.equal(SHARE_CAST_MAX_AGE_MS, 24 * 60 * 60 * 1000);
    const first = decideStandaloneShareCredit([], {
      fid: FID,
      walletAddress: WALLET,
      castHash: CAST_A,
      creditedAtIso: NOW,
    });
    const concurrent = decideStandaloneShareCredit([], {
      fid: FID,
      walletAddress: WALLET,
      castHash: CAST_B,
      creditedAtIso: NOW,
    });
    assert.equal(first.ok && !first.alreadyClaimed, true);
    assert.equal(concurrent.ok && !concurrent.alreadyClaimed, true);
    if (
      first.ok &&
      !first.alreadyClaimed &&
      concurrent.ok &&
      !concurrent.alreadyClaimed
    ) {
      assert.equal(
        standaloneCreditWindowsOverlap(
          first.row.credited_at,
          concurrent.row.credited_at,
        ),
        true,
      );
      const serialized = decideStandaloneShareCredit(
        [asLedger(first.row, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")],
        {
          fid: FID,
          walletAddress: WALLET,
          castHash: CAST_B,
          creditedAtIso: NOW,
        },
      );
      assert.equal(serialized.ok, true);
      if (serialized.ok) {
        assert.equal(serialized.alreadyClaimed, true);
      }
    }
  });
});

describe("pool race", () => {
  it("rejects a second concurrent claim that would exceed 10,000 BQR", () => {
    const filled = 9_975;
    assert.equal(wouldExceedStandalonePool(filled, 25), false);
    assert.equal(wouldExceedStandalonePool(filled + 25, 25), true);
    const existing: T2eRewardLedgerRow[] = [];
    for (let i = 0; i < filled / 25; i += 1) {
      existing.push({
        ...asLedger(
          buildStandaloneLedgerInsert({
            fid: 1_000_000 + i,
            walletAddress: `0x${(i + 1).toString(16).padStart(40, "0")}`,
            castHash: `0xb${(i + 1).toString(16).padStart(39, "0")}`,
            creditedAtIso: NOW,
          }),
          `${i.toString().padStart(8, "0")}-1111-4111-8111-111111111111`,
        ),
      });
    }
    assert.equal(sumStandaloneCreditedBqr(existing), filled);
    const first = decideStandaloneShareCredit(existing, {
      fid: FID,
      walletAddress: WALLET,
      castHash: CAST_A,
      creditedAtIso: NOW,
    });
    assert.equal(first.ok && !first.alreadyClaimed, true);
    if (!first.ok || first.alreadyClaimed) {
      return;
    }
    const afterFirst = [
      ...existing,
      asLedger(first.row, "ffffffff-ffff-4fff-8fff-ffffffffffff"),
    ];
    const second = decideStandaloneShareCredit(afterFirst, {
      fid: OTHER_FID,
      walletAddress: OTHER_WALLET,
      castHash: CAST_B,
      creditedAtIso: NOW,
    });
    assert.equal(second.ok, false);
    if (!second.ok) {
      assert.equal(second.error, "pool_depleted");
    }
  });
});

describe("insert conflict mapping", () => {
  it("maps unique, cooldown, and pool-cap errors without double credit", () => {
    assert.equal(
      classifyStandaloneLedgerInsertError({ code: "23505" }),
      "duplicate",
    );
    assert.equal(
      classifyStandaloneLedgerInsertError({
        code: "23P01",
        message: "standalone_share_cooldown",
      }),
      "cooldown",
    );
    assert.equal(
      classifyStandaloneLedgerInsertError({
        code: "23514",
        message: "standalone_pool_depleted",
      }),
      "pool_depleted",
    );
  });
});
