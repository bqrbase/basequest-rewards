import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SHARE_CAST_REWARD_BQR } from "./constants.ts";
import type { T2eRewardLedgerRow } from "./db.ts";
import {
  catalogShareCastAmountBqr,
  evaluateShareCastEligibility,
  existingCreditedShare,
  parseShareRewardRequest,
  shareCastClaimId,
  sumCreditedBqr,
} from "./share-reward-logic.ts";

const TASK_ID = "74ff717c-8124-475c-8ef4-031fd4b2b5c6";
const CREATOR = "0x1111111111111111111111111111111111111111";
const WALLET = "0x2222222222222222222222222222222222222222";
const OTHER_WALLET = "0x3333333333333333333333333333333333333333";
const CREATOR_ALT_WALLET = "0x4444444444444444444444444444444444444444";
const FID = 368591;
const CREATOR_FID = 111222;

function task(overrides: Record<string, unknown> = {}) {
  return {
    id: TASK_ID,
    creatorWallet: CREATOR,
    status: "draft" as const,
    shareCastEnabled: true,
    createdAt: "2026-08-26T10:00:00.000Z",
    ...overrides,
  };
}

function ledger(overrides: Partial<T2eRewardLedgerRow> = {}): T2eRewardLedgerRow {
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
    cast_hash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    share_id: null,
    created_at: "2026-08-26T11:00:00.000Z",
    credited_at: "2026-08-26T11:00:00.000Z",
    claimed_at: null,
    tx_hash: null,
    ...overrides,
  };
}

describe("catalog amount", () => {
  it("is a fixed 25 BQR and ignores client amounts", () => {
    assert.equal(SHARE_CAST_REWARD_BQR, 25);
    assert.equal(catalogShareCastAmountBqr(), 25);
    assert.equal(catalogShareCastAmountBqr(999), 25);
    assert.equal(catalogShareCastAmountBqr("1000"), 25);
  });
});

describe("parseShareRewardRequest", () => {
  it("keeps wallet and hash hint and ignores amount, FID, and shared flags", () => {
    const parsed = parseShareRewardRequest({
      wallet: WALLET,
      castHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      amount: 999,
      amountBqr: 50,
      fid: 1,
      creatorFid: CREATOR_FID,
      shared: true,
    });
    assert.equal(parsed.wallet, WALLET);
    assert.equal(
      parsed.castHashHint,
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );
    assert.equal("fid" in parsed, false);
    assert.equal("creatorFid" in parsed, false);
    assert.equal(catalogShareCastAmountBqr(999), 25);
  });

  it("rejects an invalid wallet", () => {
    const parsed = parseShareRewardRequest({ wallet: "not-an-address" });
    assert.equal(parsed.wallet, null);
  });
});

describe("evaluateShareCastEligibility", () => {
  it("accepts a draft task for a non-creator with a FID", () => {
    const result = evaluateShareCastEligibility({
      task: task(),
      walletAddress: WALLET,
      fid: FID,
      creatorFid: CREATOR_FID,
    });
    assert.equal(result.ok, true);
  });

  it("accepts open and active tasks", () => {
    assert.equal(
      evaluateShareCastEligibility({
        task: task({ status: "open" }),
        walletAddress: WALLET,
        fid: FID,
        creatorFid: CREATOR_FID,
      }).ok,
      true,
    );
    assert.equal(
      evaluateShareCastEligibility({
        task: task({ status: "active" }),
        walletAddress: WALLET,
        fid: FID,
        creatorFid: CREATOR_FID,
      }).ok,
      true,
    );
  });

  it("rejects a missing task", () => {
    const result = evaluateShareCastEligibility({
      task: null,
      walletAddress: WALLET,
      fid: FID,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, "task_not_found");
    }
  });

  it("rejects a cancelled task", () => {
    const result = evaluateShareCastEligibility({
      task: task({ status: "cancelled" }),
      walletAddress: WALLET,
      fid: FID,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, "task_cancelled");
    }
  });

  it("rejects creator self-share", () => {
    const result = evaluateShareCastEligibility({
      task: task(),
      walletAddress: CREATOR,
      fid: FID,
      creatorFid: CREATOR_FID,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, "creator_ineligible");
    }
  });

  it("rejects an alternate wallet that resolves to the same creator FID", () => {
    const result = evaluateShareCastEligibility({
      task: task(),
      walletAddress: CREATOR_ALT_WALLET,
      fid: CREATOR_FID,
      creatorFid: CREATOR_FID,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, "creator_ineligible");
    }
  });

  it("accepts an unrelated wallet and FID", () => {
    const result = evaluateShareCastEligibility({
      task: task(),
      walletAddress: WALLET,
      fid: FID,
      creatorFid: CREATOR_FID,
    });
    assert.equal(result.ok, true);
  });

  it("cannot be bypassed by a client-supplied fake FID", () => {
    const parsed = parseShareRewardRequest({
      wallet: CREATOR_ALT_WALLET,
      fid: 999999,
      creatorFid: 1,
    });
    assert.equal(parsed.wallet, CREATOR_ALT_WALLET);
    assert.equal("fid" in parsed, false);
    assert.equal("creatorFid" in parsed, false);
    const result = evaluateShareCastEligibility({
      task: task(),
      walletAddress: parsed.wallet ?? "",
      fid: CREATOR_FID,
      creatorFid: CREATOR_FID,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, "creator_ineligible");
    }
  });

  it("still rejects the creator wallet when claimer and creator FIDs differ", () => {
    const result = evaluateShareCastEligibility({
      task: task(),
      walletAddress: CREATOR,
      fid: FID,
      creatorFid: CREATOR_FID,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, "creator_ineligible");
    }
  });

  it("rejects a missing wallet", () => {
    const result = evaluateShareCastEligibility({
      task: task(),
      walletAddress: "",
      fid: FID,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, "valid_wallet_required");
    }
  });

  it("rejects a missing FID", () => {
    const result = evaluateShareCastEligibility({
      task: task(),
      walletAddress: WALLET,
      fid: null,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, "farcaster_required");
    }
  });

  it("rejects when share_cast_enabled is false", () => {
    const result = evaluateShareCastEligibility({
      task: task({ shareCastEnabled: false }),
      walletAddress: WALLET,
      fid: FID,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, "share_cast_disabled");
    }
  });
});

describe("idempotency", () => {
  it("uses a deterministic claim_id", () => {
    assert.equal(
      shareCastClaimId(TASK_ID, FID),
      `share_cast:${TASK_ID}:${FID}`,
    );
  });

  it("returns the existing credit for a duplicate claim_id", () => {
    const row = ledger();
    const existing = existingCreditedShare({
      claimId: row.claim_id,
      taskId: TASK_ID,
      walletAddress: WALLET,
      fid: FID,
      ledgers: [row],
    });
    assert.equal(existing?.alreadyCredited, true);
    assert.equal(existing?.ledger.claim_id, row.claim_id);
  });

  it("blocks a second wallet for the same task and FID", () => {
    const row = ledger();
    const existing = existingCreditedShare({
      claimId: shareCastClaimId(TASK_ID, FID),
      taskId: TASK_ID,
      walletAddress: OTHER_WALLET,
      fid: FID,
      ledgers: [row],
    });
    assert.equal(existing?.alreadyCredited, true);
  });

  it("blocks a duplicate share for the same task and wallet", () => {
    const row = ledger({
      claim_id: "share_cast:other:1",
      fid: 1,
    });
    const existing = existingCreditedShare({
      claimId: shareCastClaimId(TASK_ID, FID),
      taskId: TASK_ID,
      walletAddress: WALLET,
      fid: FID,
      ledgers: [row],
    });
    assert.equal(existing?.alreadyCredited, true);
  });

  it("treats a second request with the same claim as an idempotent retry", () => {
    const row = ledger();
    const first = existingCreditedShare({
      claimId: row.claim_id,
      taskId: TASK_ID,
      walletAddress: WALLET,
      fid: FID,
      ledgers: [row],
    });
    const retry = existingCreditedShare({
      claimId: row.claim_id,
      taskId: TASK_ID,
      walletAddress: WALLET,
      fid: FID,
      ledgers: [row],
    });
    assert.equal(first?.ledger.id, retry?.ledger.id);
  });
});

describe("ledger balance", () => {
  it("sums only credited Task2Earn BQR rows", () => {
    const total = sumCreditedBqr([
      ledger({ amount_bqr: 25, status: "credited" }),
      ledger({
        id: "22222222-2222-4222-8222-222222222222",
        amount_bqr: 25,
        status: "credited",
      }),
      ledger({
        id: "33333333-3333-4333-8333-333333333333",
        amount_bqr: 25,
        status: "pending",
      }),
    ]);
    assert.equal(total, 50);
  });
});
