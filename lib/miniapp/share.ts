/**
 * Official Mini App share URLs and embed metadata.
 *
 * Casts must embed the canonical https Mini App page. Farcaster clients scrape
 * `fc:miniapp` / `fc:frame` and open `launch_miniapp` inside the client instead
 * of a normal browser tab.
 *
 * @farcaster/miniapp-sdk has no Snap action. Outbound share is composeCast.
 * Universal Links (`https://farcaster.xyz/miniapps/<id>/...`) need a published
 * app id we do not have here — do not invent one.
 */

export const MINI_APP_ORIGIN = "https://basequest.online";
export const MINI_APP_NAME = "BaseQuest Rewards";
export const MINI_APP_EMBED_IMAGE = `${MINI_APP_ORIGIN}/farcaster-embed.png`;
export const MINI_APP_SPLASH_IMAGE = `${MINI_APP_ORIGIN}/splash-icon.png`;
export const MINI_APP_SPLASH_BACKGROUND = "#070b18";
export const FARCASTER_COMPOSE_BASE = "https://farcaster.xyz/~/compose";

/** SDK actions that exist on MiniAppSDK.actions — there is no snap/share. */
export const FARCASTER_MINIAPP_SHARE_ACTIONS = [
  "composeCast",
  "openUrl",
  "openMiniApp",
] as const;

export function canonicalAppUrl(): string {
  return MINI_APP_ORIGIN;
}

export function canonicalTaskUrl(taskId?: string): string {
  const id = taskId?.trim();
  if (!id) {
    return `${MINI_APP_ORIGIN}/tasks`;
  }
  return `${MINI_APP_ORIGIN}/tasks/${encodeURIComponent(id)}`;
}

/** Existing Base Wallet Score experience — not a Task2Earn task page. */
export function canonicalScoreUrl(): string {
  return `${MINI_APP_ORIGIN}/base-wallet-score`;
}

/** Static Task2Earn share preview scraped by Farcaster (not the Mini App action URL). */
export function canonicalTaskShareImageUrl(_taskId?: string): string {
  return `${MINI_APP_ORIGIN}/share-cards/task2earn-share.png`;
}

/** Distinct Snap/score preview — not the Task2Earn campaign card. */
export function canonicalScoreShareImageUrl(): string {
  return `${MINI_APP_ORIGIN}/share-cards/score-share.png`;
}

/** Static standalone BQR Share Rewards preview — not a task or score card. */
export function canonicalShareRewardsImageUrl(): string {
  return `${MINI_APP_ORIGIN}/images/bqr-share-rewards.png`;
}

export function farcasterComposeUrl(
  text: string,
  embedUrl: string,
  imageUrl?: string,
): string {
  const embeds = imageUrl
    ? `&embeds[]=${encodeURIComponent(embedUrl)}&embeds[]=${encodeURIComponent(imageUrl)}`
    : `&embeds[]=${encodeURIComponent(embedUrl)}`;
  return `${FARCASTER_COMPOSE_BASE}?text=${encodeURIComponent(text)}${embeds}`;
}

export type MiniAppEmbedActionType = "launch_miniapp" | "launch_frame";

export type MiniAppEmbed = {
  version: "1";
  imageUrl: string;
  button: {
    title: string;
    action: {
      type: MiniAppEmbedActionType;
      name: string;
      url: string;
      splashImageUrl: string;
      splashBackgroundColor: string;
    };
  };
};

export function buildMiniAppEmbed(params: {
  url: string;
  buttonTitle: string;
  actionType: MiniAppEmbedActionType;
  imageUrl?: string;
}): MiniAppEmbed {
  return {
    version: "1",
    imageUrl: params.imageUrl ?? MINI_APP_EMBED_IMAGE,
    button: {
      title: params.buttonTitle,
      action: {
        type: params.actionType,
        name: MINI_APP_NAME,
        url: params.url,
        splashImageUrl: MINI_APP_SPLASH_IMAGE,
        splashBackgroundColor: MINI_APP_SPLASH_BACKGROUND,
      },
    },
  };
}

export function buildMiniAppEmbedTags(params: {
  url: string;
  buttonTitle: string;
  imageUrl?: string;
}): Record<"fc:miniapp" | "fc:frame", string> {
  return {
    "fc:miniapp": JSON.stringify(
      buildMiniAppEmbed({ ...params, actionType: "launch_miniapp" }),
    ),
    "fc:frame": JSON.stringify(
      buildMiniAppEmbed({ ...params, actionType: "launch_frame" }),
    ),
  };
}

export type TaskCastShareInput = {
  title: string;
  rewardToken: string;
  poolAmount: string;
  durationDays: number;
};

export function shareRewardsCastText(): string {
  return [
    "Just unlocked my BQR rewards 🚀",
    "━━━━━━━━━━━━━━━━━━━━━━",
    "💎 Total Reward Pool: 10,000 BQR",
    "⚡ Daily drops: 25 BQR per user",
    "🎁 Free · Daily · Instant reward",
    "━━━━━━━━━━━━━━━━━━━━━━",
    "👇 Claim your free BQR now — don't miss today's drop!",
  ].join("\n");
}

export function taskCastText(input: TaskCastShareInput | string): string {
  if (typeof input === "string") {
    const trimmed = input.trim() || "this campaign";
    return [
      `Join this Task2Earn: ${trimmed} 🚀`,
      "🎯 Complete the task",
      "💰 Earn rewards",
      "👇 Complete the task and earn your reward!",
    ].join("\n");
  }
  const title = input.title.trim() || "this campaign";
  const pool = input.poolAmount.trim() || "—";
  const token = input.rewardToken.trim() || "rewards";
  const days = Number.isFinite(input.durationDays) ? input.durationDays : 1;
  return [
    `Join this Task2Earn: ${title} 🚀`,
    "🎯 Complete the task",
    "💰 Earn rewards",
    `⚡ ${token} reward pool: ${pool}`,
    `⏱️ Duration: ${days} day(s)`,
    "👇 Complete the task and earn your reward!",
  ].join("\n");
}

export type ScoreSnapInput = {
  neynarScore: number | null;
  walletScore: number | null;
};

function formatNeynarScore(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }
  return value.toFixed(2);
}

function formatWalletScore(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }
  return String(Math.round(value));
}

/**
 * Share Snap copy. Ethos is not in this app — Base Wallet Score is the
 * existing 0–1000 reputation metric. There is no Farcaster Snap API.
 */
export function scoreSnapText(input: ScoreSnapInput): string {
  return [
    "My Scores reflect my social reputation 👇",
    `🟣 Neynar: ${formatNeynarScore(input.neynarScore)}`,
    `🟢 Base Wallet Score: ${formatWalletScore(input.walletScore)}`,
    "Check your score now! 🔍",
  ].join("\n");
}
