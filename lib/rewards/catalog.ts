import type { QuestId } from "@/lib/quest-engine";
import type { RewardDefinition } from "@/lib/rewards/types";

/**
 * Central BQR reward values for supported actions.
 * Isolated from quest XP (`rewardXp`) and referral XP (`REFERRAL_REWARD_XP`).
 * Adjust here when product defines token payouts; Claim will consume this catalog.
 */
export const REWARD_DEFINITIONS: readonly RewardDefinition[] = [
  {
    actionId: "connect-wallet",
    kind: "wallet",
    label: "Connect Wallet",
    description: "Connect a wallet to BaseQuest Rewards.",
    amountBqr: 10,
    grantMode: "one_time",
  },
  {
    actionId: "daily-check-in",
    kind: "quest",
    label: "Daily Check-in",
    description: "Complete the daily check-in onboarding quest.",
    amountBqr: 5,
    questId: "daily-check-in",
    grantMode: "one_time",
  },
  {
    actionId: "referral",
    kind: "referral",
    label: "Referral",
    description:
      "Per successful referral after the invitee completes onboarding.",
    amountBqr: 50,
    grantMode: "per_referral",
  },
  // Quest-aligned future BQR rewards (eligibility when quest completed).
  {
    actionId: "view-leaderboard",
    kind: "quest",
    label: "View Leaderboard",
    description: "Open the leaderboard quest.",
    amountBqr: 5,
    questId: "view-leaderboard",
    grantMode: "one_time",
  },
  {
    actionId: "build-streak",
    kind: "quest",
    label: "Build Streak",
    description: "Build your engagement streak.",
    amountBqr: 5,
    questId: "build-streak",
    grantMode: "one_time",
  },
  {
    actionId: "explore-base",
    kind: "quest",
    label: "Explore Base",
    description: "Explore the Base ecosystem.",
    amountBqr: 10,
    questId: "explore-base",
    grantMode: "one_time",
  },
  {
    actionId: "follow-x",
    kind: "quest",
    label: "Follow on X",
    description: "Complete the X follow quest.",
    amountBqr: 10,
    questId: "follow-x",
    grantMode: "one_time",
  },
  {
    actionId: "follow-farcaster",
    kind: "quest",
    label: "Follow on Farcaster",
    description: "Complete the Farcaster follow quest.",
    amountBqr: 10,
    questId: "follow-farcaster",
    grantMode: "one_time",
  },
  {
    actionId: "deploy-contract",
    kind: "quest",
    label: "Deploy Contract",
    description: "Deploy a contract on Base.",
    amountBqr: 25,
    questId: "deploy-contract",
    grantMode: "one_time",
  },
  {
    actionId: "claim-nft",
    kind: "quest",
    label: "Claim NFT",
    description: "Claim a BaseQuest NFT.",
    amountBqr: 25,
    questId: "claim-nft",
    grantMode: "one_time",
  },
  {
    actionId: "x402-payment",
    kind: "quest",
    label: "x402 Payment",
    description: "Complete an x402 payment.",
    amountBqr: 40,
    questId: "x402-payment",
    grantMode: "one_time",
  },
  {
    actionId: "first-swap",
    kind: "quest",
    label: "First Swap",
    description: "Complete your first Base swap.",
    amountBqr: 15,
    questId: "first-swap",
    grantMode: "one_time",
  },
  {
    actionId: "bridge-to-base",
    kind: "quest",
    label: "Bridge to Base",
    description: "Bridge assets onto Base.",
    amountBqr: 20,
    questId: "bridge-to-base",
    grantMode: "one_time",
  },
  // Reserved placeholders — never eligible until activated in catalog.
  {
    actionId: "future:liquidity",
    kind: "future",
    label: "Provide Liquidity",
    description: "Reserved for a future DeFi quest reward.",
    amountBqr: 0,
    grantMode: "future",
  },
  {
    actionId: "future:governance",
    kind: "future",
    label: "Governance Participation",
    description: "Reserved for a future governance reward.",
    amountBqr: 0,
    grantMode: "future",
  },
] as const;

const byActionId = new Map(
  REWARD_DEFINITIONS.map((definition) => [definition.actionId, definition]),
);

const byQuestId = new Map(
  REWARD_DEFINITIONS.filter(
    (definition): definition is RewardDefinition & { questId: QuestId } =>
      Boolean(definition.questId),
  ).map((definition) => [definition.questId, definition]),
);

export function getRewardDefinition(
  actionId: RewardDefinition["actionId"],
): RewardDefinition | null {
  return byActionId.get(actionId) ?? null;
}

export function getRewardDefinitionForQuest(
  questId: QuestId,
): RewardDefinition | null {
  return byQuestId.get(questId) ?? null;
}

export function listRewardDefinitions(): readonly RewardDefinition[] {
  return REWARD_DEFINITIONS;
}
