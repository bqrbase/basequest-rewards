import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FARCASTER_MINIAPP_SHARE_ACTIONS,
  MINI_APP_EMBED_IMAGE,
  buildMiniAppEmbed,
  buildMiniAppEmbedTags,
  canonicalScoreShareImageUrl,
  canonicalScoreUrl,
  canonicalTaskShareImageUrl,
  canonicalTaskUrl,
  farcasterComposeUrl,
  scoreSnapText,
  taskCastText,
} from "./share.ts";

const TASK_ID = "74ff717c-8124-475c-8ef4-031fd4b2b5c6";
const CAST_INPUT = {
  title: "Follow @hqcrp",
  rewardToken: "USDC",
  poolAmount: "5.2",
  durationDays: 1,
};

describe("Mini App share URLs", () => {
  it("uses the canonical BaseQuest task URL, not a custom protocol", () => {
    const url = canonicalTaskUrl(TASK_ID);
    assert.equal(url, `https://basequest.online/tasks/${TASK_ID}`);
    assert.equal(url.startsWith("https://"), true);
    assert.equal(url.includes("farcaster.xyz/miniapps/"), false);
  });

  it("points the task share preview at a task-specific card, not the homepage image", () => {
    const image = canonicalTaskShareImageUrl(TASK_ID);
    assert.equal(
      image,
      "https://basequest.online/share-cards/task2earn-share.png",
    );
    assert.notEqual(image, MINI_APP_EMBED_IMAGE);
    assert.equal(image.includes("og-image.png"), false);
    assert.equal(image.includes("farcaster-embed.png"), false);
    assert.equal(image.includes(`/tasks/${TASK_ID}`), false);
  });

  it("uses the Base Wallet Score route for Share Snap, never a task URL", () => {
    const scoreUrl = canonicalScoreUrl();
    assert.equal(scoreUrl, "https://basequest.online/base-wallet-score");
    assert.equal(scoreUrl.includes("/tasks/"), false);
    assert.notEqual(scoreUrl, canonicalTaskUrl(TASK_ID));
    assert.equal(
      canonicalScoreShareImageUrl(),
      "https://basequest.online/share-cards/score-share.png",
    );
    assert.notEqual(
      canonicalScoreShareImageUrl(),
      canonicalTaskShareImageUrl(TASK_ID),
    );
  });

  it("builds distinct Cast and Snap compose URLs", () => {
    const castText = taskCastText(CAST_INPUT);
    const snapText = scoreSnapText({ neynarScore: 0.28, walletScore: 989 });
    const castCompose = farcasterComposeUrl(castText, canonicalTaskUrl(TASK_ID));
    const snapCompose = farcasterComposeUrl(snapText, canonicalScoreUrl());
    assert.notEqual(castText, snapText);
    assert.notEqual(castCompose, snapCompose);
    assert.equal(
      castCompose.includes(encodeURIComponent(canonicalTaskUrl(TASK_ID))),
      true,
    );
    assert.equal(
      snapCompose.includes(encodeURIComponent(canonicalScoreUrl())),
      true,
    );
    assert.equal(
      snapCompose.includes(encodeURIComponent(`/tasks/${TASK_ID}`)),
      false,
    );
  });
});

describe("share copy", () => {
  it("promotes the specific Task2Earn campaign with pool and duration", () => {
    const text = taskCastText(CAST_INPUT);
    assert.equal(text.includes("Join this Task2Earn: Follow @hqcrp 🚀"), true);
    assert.equal(text.includes("USDC reward pool: 5.2"), true);
    assert.equal(text.includes("Duration: 1 day(s)"), true);
    assert.equal(text.includes("/profile"), false);
    assert.equal(text.includes("base-wallet-score"), false);
  });

  it("summarizes Neynar and Base Wallet Score, not a task URL", () => {
    const text = scoreSnapText({ neynarScore: 0.28, walletScore: 989 });
    assert.equal(text.includes("🟣 Neynar: 0.28"), true);
    assert.equal(text.includes("🟢 Base Wallet Score: 989"), true);
    assert.equal(text.includes("/tasks/"), false);
    assert.equal(text.includes("reward pool"), false);
  });
});

describe("Mini App embed metadata", () => {
  it("emits launch_miniapp with the task URL and task-specific image", () => {
    const url = canonicalTaskUrl(TASK_ID);
    const imageUrl = canonicalTaskShareImageUrl(TASK_ID);
    const embed = buildMiniAppEmbed({
      url,
      buttonTitle: "Complete Task",
      actionType: "launch_miniapp",
      imageUrl,
    });
    assert.equal(embed.button.action.type, "launch_miniapp");
    assert.equal(embed.button.action.url, url);
    assert.equal(embed.imageUrl, imageUrl);
    assert.notEqual(embed.imageUrl, MINI_APP_EMBED_IMAGE);
  });

  it("emits launch_miniapp pointing at the score page with a distinct image", () => {
    const url = canonicalScoreUrl();
    const tags = buildMiniAppEmbedTags({
      url,
      buttonTitle: "Check Score",
      imageUrl: canonicalScoreShareImageUrl(),
    });
    const miniapp = JSON.parse(tags["fc:miniapp"]) as {
      imageUrl: string;
      button: { action: { type: string; url: string } };
    };
    assert.equal(miniapp.button.action.type, "launch_miniapp");
    assert.equal(miniapp.button.action.url, url);
    assert.equal(miniapp.imageUrl, canonicalScoreShareImageUrl());
    assert.notEqual(miniapp.imageUrl, canonicalTaskShareImageUrl(TASK_ID));
  });

  it("does not claim a Snap SDK action exists", () => {
    assert.equal(
      (FARCASTER_MINIAPP_SHARE_ACTIONS as readonly string[]).includes("snap"),
      false,
    );
    assert.equal(FARCASTER_MINIAPP_SHARE_ACTIONS.includes("composeCast"), true);
  });
});
