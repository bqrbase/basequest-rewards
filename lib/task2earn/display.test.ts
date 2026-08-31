import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { joinedTaskSection } from "./joined-section.ts";

const future = new Date(Date.now() + 86_400_000).toISOString();
const past = new Date(Date.now() - 86_400_000).toISOString();

describe("joinedTaskSection", () => {
  it("puts verified participation in Completed regardless of campaign clock", () => {
    assert.equal(
      joinedTaskSection({
        status: "active",
        endsAt: future,
        viewerParticipantStatus: "verified",
      }),
      "completed",
    );
    assert.equal(
      joinedTaskSection({
        status: "ended",
        endsAt: past,
        viewerParticipantStatus: "verified",
      }),
      "completed",
    );
  });

  it("puts unverified live campaigns in Ongoing", () => {
    assert.equal(
      joinedTaskSection({
        status: "open",
        endsAt: future,
        viewerParticipantStatus: "joined",
      }),
      "ongoing",
    );
    assert.equal(
      joinedTaskSection({
        status: "active",
        endsAt: future,
        viewerParticipantStatus: "rejected",
      }),
      "ongoing",
    );
  });

  it("puts unverified ended or expired campaigns in Ended", () => {
    assert.equal(
      joinedTaskSection({
        status: "ended",
        endsAt: past,
        viewerParticipantStatus: "joined",
      }),
      "ended",
    );
    assert.equal(
      joinedTaskSection({
        status: "active",
        endsAt: past,
        viewerParticipantStatus: "joined",
      }),
      "ended",
    );
    assert.equal(
      joinedTaskSection({
        status: "cancelled",
        endsAt: future,
        viewerParticipantStatus: "joined",
      }),
      "ended",
    );
  });
});
