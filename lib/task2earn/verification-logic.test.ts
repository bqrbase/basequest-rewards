import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  allChecksPassed,
  checkComment,
  checkFollow,
  checkLike,
  checkRecast,
  combineTaskChecks,
  evaluateAudience,
  findMatchingReply,
  hashesReferToSameCast,
  missingFidCheck,
  NON_SPAM_MIN_SCORE,
  parseCastLookup,
  parseNeynarUserProfile,
  parseReplyCast,
  parseReplyFeed,
  unsupportedMiniAppCheck,
  unsupportedShareSnapCheck,
  type ParsedUserProfile,
} from "./verification-logic.ts";

const NOW = Date.parse("2026-08-24T00:00:00.000Z");

function profile(overrides: Partial<ParsedUserProfile> = {}): ParsedUserProfile {
  return {
    fid: 123,
    followerCount: 50,
    score: 0.8,
    scoreSource: "score",
    registeredAt: "2025-01-01T00:00:00.000Z",
    pfpUrl: "https://example.com/p.png",
    ...overrides,
  };
}

describe("identity", () => {
  it("missing FID is ineligible and never a pass", () => {
    const check = missingFidCheck();
    assert.equal(check.status, "ineligible");
    assert.equal(allChecksPassed([check]), false);
  });
});

describe("follow", () => {
  it("passes when following", () => {
    assert.equal(checkFollow(true).status, "passed");
  });

  it("fails when not following", () => {
    assert.equal(checkFollow(false).status, "failed");
    assert.equal(allChecksPassed([checkFollow(false)]), false);
  });
});

describe("like", () => {
  it("passes when liked", () => {
    assert.equal(checkLike(true).status, "passed");
  });

  it("fails when not liked", () => {
    assert.equal(checkLike(false).status, "failed");
  });
});

describe("recast", () => {
  it("passes when recasted", () => {
    assert.equal(checkRecast(true).status, "passed");
  });

  it("fails when not recasted", () => {
    assert.equal(checkRecast(false).status, "failed");
  });
});

describe("like + recast", () => {
  it("requires both liked and recasted", () => {
    assert.equal(
      allChecksPassed(combineTaskChecks([[checkLike(true)], [checkRecast(true)]])),
      true,
    );
    assert.equal(allChecksPassed([checkLike(true), checkRecast(false)]), false);
    assert.equal(allChecksPassed([checkLike(false), checkRecast(true)]), false);
  });
});

describe("comment", () => {
  const targetHash = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const reply = parseReplyCast({
    hash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    author: { fid: 99 },
    parent_hash: targetHash,
    thread_hash: targetHash,
  });

  it("matches a participant reply on the target cast", () => {
    assert.ok(reply);
    const match = findMatchingReply([reply], 99, { hash: targetHash });
    assert.ok(match);
    assert.equal(checkComment(true).status, "passed");
  });

  it("rejects another author's reply and unmatched parents", () => {
    assert.ok(reply);
    assert.equal(findMatchingReply([reply], 1, { hash: targetHash }), null);
    assert.equal(
      findMatchingReply([reply], 99, {
        hash: "0xcccccccccccccccccccccccccccccccccccccccc",
      }),
      null,
    );
    assert.equal(checkComment(false).status, "failed");
  });

  it("parses replies_and_recasts feed pages", () => {
    const parsed = parseReplyFeed({
      casts: [
        {
          hash: "0xdddddddddddddddddddddddddddddddddddddddd",
          author: { fid: 7 },
          parent: { hash: targetHash },
        },
      ],
      next: { cursor: "abc" },
    });
    assert.equal(parsed.replies.length, 1);
    assert.equal(parsed.cursor, "abc");
    assert.ok(findMatchingReply(parsed.replies, 7, { hash: targetHash }));
  });
});

describe("cast lookup", () => {
  it("reads canonical hash, author FID, liked, and recasted", () => {
    const cast = parseCastLookup({
      cast: {
        hash: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        url: "https://farcaster.xyz/a/0xeeee",
        author: { fid: 42 },
        viewer_context: { liked: true, recasted: false },
      },
    });
    assert.ok(cast);
    assert.equal(cast.hash, "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee");
    assert.equal(cast.authorFid, 42);
    assert.equal(cast.liked, true);
    assert.equal(cast.recasted, false);
  });

  it("treats truncated hashes as the same cast", () => {
    assert.equal(
      hashesReferToSameCast("0xeeeeeeee", "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"),
      true,
    );
  });
});

describe("audience", () => {
  it("passes automatically when no filters are configured", () => {
    const result = evaluateAudience(null, {});
    assert.equal(result.ok, true);
    assert.equal(result.checks[0]?.status, "passed");
  });

  it("enforces follower, score, age, non-spam, and photo filters", () => {
    const ok = evaluateAudience(
      profile(),
      {
        minimum_followers: 10,
        minimum_neynar_score: 0.5,
        minimum_account_age_days: 30,
        non_spam_only: true,
        profile_photo_required: true,
      },
      NOW,
    );
    assert.equal(ok.ok, true);

    const lowFollowers = evaluateAudience(
      profile({ followerCount: 2 }),
      { minimum_followers: 10 },
      NOW,
    );
    assert.equal(lowFollowers.ok, false);

    const lowScore = evaluateAudience(
      profile({ score: 0.1 }),
      { minimum_neynar_score: 0.5 },
      NOW,
    );
    assert.equal(lowScore.ok, false);

    const young = evaluateAudience(
      profile({ registeredAt: "2026-08-20T00:00:00.000Z" }),
      { minimum_account_age_days: 30 },
      NOW,
    );
    assert.equal(young.ok, false);

    const spam = evaluateAudience(
      profile({ score: NON_SPAM_MIN_SCORE - 0.01 }),
      { non_spam_only: true },
      NOW,
    );
    assert.equal(spam.ok, false);

    const noPhoto = evaluateAudience(
      profile({ pfpUrl: null }),
      { profile_photo_required: true },
      NOW,
    );
    assert.equal(noPhoto.ok, false);
  });

  it("fails closed when a required Neynar score field is missing", () => {
    const missing = evaluateAudience(
      profile({ score: null, scoreSource: null }),
      { minimum_neynar_score: 0.5, non_spam_only: true },
      NOW,
    );
    assert.equal(missing.ok, false);
  });

  it("prefers live score, then experimental.neynar_user_score", () => {
    const fromScore = parseNeynarUserProfile(
      { users: [{ fid: 9, follower_count: 1, score: 0.7, pfp_url: "x" }] },
      9,
    );
    assert.equal(fromScore?.score, 0.7);
    assert.equal(fromScore?.scoreSource, "score");

    const fromExperimental = parseNeynarUserProfile(
      {
        users: [
          {
            fid: 9,
            follower_count: 1,
            experimental: { neynar_user_score: 0.61 },
            pfp_url: "x",
          },
        ],
      },
      9,
    );
    assert.equal(fromExperimental?.score, 0.61);
    assert.equal(fromExperimental?.scoreSource, "experimental.neynar_user_score");
  });
});

describe("aggregate requirements", () => {
  it("passes only when every required check passes", () => {
    const passed = combineTaskChecks([
      evaluateAudience(profile(), { minimum_followers: 1 }, NOW).checks,
      [checkFollow(true), checkLike(true), checkRecast(true), checkComment(true)],
    ]);
    assert.equal(allChecksPassed(passed), true);
  });

  it("fails when one required action fails", () => {
    const checks = [
      checkFollow(true),
      checkLike(true),
      checkRecast(false),
      checkComment(true),
    ];
    assert.equal(allChecksPassed(checks), false);
  });

  it("does not treat Share Snap unsupported as a required pass", () => {
    const checks = [checkLike(true), unsupportedShareSnapCheck()];
    assert.equal(checks[1]?.status, "unsupported");
    assert.equal(allChecksPassed(checks), true);
  });
});

describe("unsupported actions", () => {
  it("Mini App open is unsupported and never verified", () => {
    const check = unsupportedMiniAppCheck();
    assert.equal(check.status, "unsupported");
    assert.equal(allChecksPassed([check]), false);
  });

  it("Share Snap is unsupported and is not navigator.share proof", () => {
    const check = unsupportedShareSnapCheck();
    assert.equal(check.status, "unsupported");
    assert.match(check.message, /not Farcaster proof/i);
  });
});
