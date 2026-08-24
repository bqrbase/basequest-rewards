import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  audienceFailureReason,
  isSuccessfulVerification,
  mapJoinError,
  mapVerificationRows,
  mapVerifyError,
  resolveVerifyHeadline,
} from "./verification-ui.ts";

describe("verification row mapping", () => {
  it("marks unneeded actions as not required", () => {
    const rows = mapVerificationRows({
      taskType: "like",
      audience: {},
      checks: null,
    });
    const follow = rows.find((row) => row.slot === "follow");
    const like = rows.find((row) => row.slot === "like");
    const audience = rows.find((row) => row.slot === "audience");
    assert.equal(follow?.status, "not_required");
    assert.equal(follow?.statusLabel, "Not required");
    assert.equal(like?.status, null);
    assert.equal(audience?.status, "not_required");
  });

  it("maps passed, failed, unsupported, and ineligible checks", () => {
    const rows = mapVerificationRows({
      taskType: "like_recast_comment",
      audience: { minimum_followers: 50 },
      checks: [
        { type: "like", status: "passed", message: "Liked the target cast" },
        { type: "recast", status: "failed", message: "Has not recasted the target cast" },
        { type: "comment", status: "unsupported", message: "unsupported" },
        {
          type: "audience.followers",
          status: "failed",
          message: "Followers 2 below 50+",
        },
      ],
    });
    assert.equal(rows.find((row) => row.slot === "like")?.status, "verified");
    assert.equal(rows.find((row) => row.slot === "recast")?.status, "not_verified");
    assert.equal(rows.find((row) => row.slot === "comment")?.status, "unable");
    assert.equal(rows.find((row) => row.slot === "follow")?.status, "not_required");
    const audience = rows.find((row) => row.slot === "audience");
    assert.equal(audience?.status, "not_verified");
    assert.equal(audience?.reason, "Minimum followers: 50+ required");
  });

  it("does not treat Share Snap as a requirement row", () => {
    const rows = mapVerificationRows({
      taskType: "follow",
      audience: {},
      checks: [
        { type: "follow", status: "passed", message: "Following" },
        { type: "share_snap", status: "unsupported", message: "not proof" },
      ],
    });
    assert.equal(rows.some((row) => row.slot === "follow" && row.status === "verified"), true);
    assert.equal(rows.every((row) => row.slot !== ("share_snap" as never)), true);
  });

  it("maps missing FID to unable, not verified", () => {
    const rows = mapVerificationRows({
      taskType: "follow",
      audience: {},
      checks: [
        {
          type: "identity",
          status: "ineligible",
          message: "No Farcaster FID is linked to this wallet.",
        },
      ],
    });
    const follow = rows.find((row) => row.slot === "follow");
    assert.equal(follow?.status, "unable");
    assert.notEqual(follow?.status, "verified");
  });
});

describe("audience copy", () => {
  it("uses configured thresholds instead of raw Neynar counts", () => {
    assert.equal(
      audienceFailureReason(
        {
          type: "audience.followers",
          status: "failed",
          message: "Followers 2 below 50+",
        },
        { minimum_followers: 50 },
      ),
      "Minimum followers: 50+ required",
    );
    assert.equal(
      audienceFailureReason(
        { type: "audience.score", status: "failed", message: "score 0.1" },
        { minimum_neynar_score: 0.5 },
      ),
      "Minimum Neynar Score required",
    );
  });
});

describe("headlines and errors", () => {
  it("never treats an API error as verified", () => {
    assert.equal(
      isSuccessfulVerification({
        httpOk: false,
        eligible: true,
        error: "boom",
      }),
      false,
    );
    assert.equal(
      isSuccessfulVerification({
        httpOk: true,
        eligible: true,
        error: null,
      }),
      true,
    );
    assert.equal(
      resolveVerifyHeadline({
        taskType: "like",
        verifying: false,
        attempted: true,
        eligible: false,
        error: "Task not found.",
      }).title,
      "Task not found.",
    );
    assert.notEqual(
      resolveVerifyHeadline({
        taskType: "like",
        verifying: false,
        attempted: true,
        eligible: false,
        error: "Task not found.",
      }).tone,
      "success",
    );
  });

  it("shows Mini App as verification unavailable", () => {
    const headline = resolveVerifyHeadline({
      taskType: "mini_app",
      verifying: false,
      attempted: false,
      eligible: false,
      error: null,
    });
    assert.equal(headline.title, "Verification unavailable");
    assert.match(headline.detail ?? "", /cannot currently be verified/i);
  });

  it("uses the requested idle, pending, success, and failure copy", () => {
    assert.equal(
      resolveVerifyHeadline({
        taskType: "follow",
        verifying: false,
        attempted: false,
        eligible: false,
        error: null,
      }).title,
      "Complete the task, then verify.",
    );
    assert.equal(
      resolveVerifyHeadline({
        taskType: "follow",
        verifying: true,
        attempted: false,
        eligible: false,
        error: null,
      }).title,
      "Verifying...",
    );
    assert.equal(
      resolveVerifyHeadline({
        taskType: "follow",
        verifying: false,
        attempted: true,
        eligible: true,
        error: null,
      }).title,
      "Task verified",
    );
    assert.equal(
      resolveVerifyHeadline({
        taskType: "follow",
        verifying: false,
        attempted: true,
        eligible: false,
        error: null,
      }).title,
      "Task not completed yet",
    );
  });

  it("maps server error codes to safe copy", () => {
    assert.equal(mapVerifyError("participant_not_found"), "Join this task before verifying.");
    assert.equal(mapVerifyError("unavailable"), "Farcaster verification is temporarily unavailable.");
    assert.equal(
      mapJoinError("task_not_joinable"),
      "Drafts cannot be joined until the campaign is open.",
    );
  });
});
