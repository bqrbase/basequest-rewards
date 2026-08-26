import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { canonicalTaskUrl, MINI_APP_ORIGIN } from "../miniapp/share.ts";
import {
  evaluateShareCastProof,
  extractShareCasts,
  findMatchingShareCast,
  parseShareCast,
  type ParsedShareCast,
  type ShareCastProofRules,
} from "./share-verify.ts";

const TASK_ID = "74ff717c-8124-475c-8ef4-031fd4b2b5c6";
const TASK_URL = canonicalTaskUrl(TASK_ID);
const FID = 368591;
const TASK_CREATED = Date.parse("2026-08-20T10:00:00.000Z");
const NOW = Date.parse("2026-08-26T12:00:00.000Z");

const rules: ShareCastProofRules = {
  expectedFid: FID,
  taskUrl: TASK_URL,
  taskCreatedAtMs: TASK_CREATED,
  nowMs: NOW,
};

function rawCast(overrides: Record<string, unknown> = {}) {
  return {
    hash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    timestamp: "2026-08-26T11:00:00.000Z",
    text: "Join this Task2Earn campaign",
    parent_hash: null,
    author: { fid: FID },
    embeds: [{ url: TASK_URL }],
    ...overrides,
  };
}

function parsed(overrides: Partial<ParsedShareCast> = {}): ParsedShareCast {
  return {
    hash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    authorFid: FID,
    timestampMs: Date.parse("2026-08-26T11:00:00.000Z"),
    text: "Join this Task2Earn campaign",
    parentHash: null,
    embedUrls: [TASK_URL],
    hasQuotedCast: false,
    isRecast: false,
    ...overrides,
  };
}

describe("parseShareCast", () => {
  it("parses a Neynar lookup payload", () => {
    const cast = parseShareCast({ cast: rawCast() });
    assert.equal(cast?.authorFid, FID);
    assert.equal(cast?.embedUrls.includes(TASK_URL), true);
    assert.equal(cast?.parentHash, null);
  });
});

describe("share cast proof", () => {
  it("accepts a valid original cast with the exact task embed", () => {
    assert.equal(evaluateShareCastProof(parsed(), rules), "valid");
  });

  it("rejects a missing cast", () => {
    assert.equal(evaluateShareCastProof(null, rules), "missing_cast");
  });

  it("rejects a wallet FID that does not match the cast author", () => {
    assert.equal(
      evaluateShareCastProof(parsed({ authorFid: 1 }), rules),
      "wrong_author",
    );
  });

  it("rejects replies", () => {
    assert.equal(
      evaluateShareCastProof(
        parsed({ parentHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }),
        rules,
      ),
      "reply",
    );
  });

  it("rejects recasts and quotes of someone else's cast", () => {
    assert.equal(
      evaluateShareCastProof(parsed({ isRecast: true }), rules),
      "recast_or_quote",
    );
    assert.equal(
      evaluateShareCastProof(parsed({ hasQuotedCast: true }), rules),
      "recast_or_quote",
    );
  });

  it("rejects a URL only mentioned in text", () => {
    assert.equal(
      evaluateShareCastProof(
        parsed({
          embedUrls: [],
          text: `Check this: ${TASK_URL}`,
        }),
        rules,
      ),
      "url_in_text_only",
    );
  });

  it("rejects the wrong task URL embed", () => {
    assert.equal(
      evaluateShareCastProof(
        parsed({
          embedUrls: [`${MINI_APP_ORIGIN}/tasks/11111111-1111-4111-8111-111111111111`],
        }),
        rules,
      ),
      "wrong_task_url",
    );
  });

  it("rejects the /tasks listing URL", () => {
    assert.equal(
      evaluateShareCastProof(
        parsed({ embedUrls: [`${MINI_APP_ORIGIN}/tasks`] }),
        rules,
      ),
      "listing_url",
    );
  });

  it("rejects a stale cast older than 24 hours", () => {
    assert.equal(
      evaluateShareCastProof(
        parsed({ timestampMs: NOW - 25 * 60 * 60 * 1000 }),
        rules,
      ),
      "stale_cast",
    );
  });

  it("rejects a cast created before the task", () => {
    assert.equal(
      evaluateShareCastProof(
        parsed({ timestampMs: TASK_CREATED - 60_000 }),
        rules,
      ),
      "before_task",
    );
  });
});

describe("findMatchingShareCast", () => {
  it("skips invalid casts and returns the first valid original share", () => {
    const match = findMatchingShareCast(
      [
        parsed({ parentHash: "0xcccccccccccccccccccccccccccccccccccccccc" }),
        parsed({
          hash: "0xdddddddddddddddddddddddddddddddddddddddd",
        }),
      ],
      rules,
    );
    assert.equal(match.reason, "valid");
    assert.equal(
      match.cast?.hash,
      "0xdddddddddddddddddddddddddddddddddddddddd",
    );
  });
});

describe("extractShareCasts", () => {
  it("reads a user casts feed payload", () => {
    const casts = extractShareCasts({ casts: [rawCast()] });
    assert.equal(casts.length, 1);
    assert.equal(evaluateShareCastProof(casts[0] ?? null, rules), "valid");
  });
});
