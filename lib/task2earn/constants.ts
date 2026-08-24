import type {
  CampaignDuration,
  CampaignRules,
  PoolSplitMode,
  RewardToken,
  TaskType,
} from "./types";

export const TASK_TYPES = [
  "follow",
  "like",
  "recast",
  "comment",
  "like_recast",
  "like_recast_comment",
  "bundle",
  "mini_app",
] as const satisfies readonly TaskType[];

export const REWARD_TOKENS = ["BQR", "USDC", "ETH"] as const satisfies readonly RewardToken[];

export const CAMPAIGN_DURATION_DAYS = [
  1, 2, 3, 7,
] as const satisfies readonly CampaignDuration[];

export const POOL_SPLIT_MODE: PoolSplitMode = "equal";

export const FOLLOWER_MINIMUM_OPTIONS = [
  50, 100, 500, 1000, 5000, 10000,
] as const;

export const ACCOUNT_AGE_MINIMUM_OPTIONS = [10, 30, 60] as const;

export const TITLE_MIN_LENGTH = 3;
export const TITLE_MAX_LENGTH = 80;
export const DESCRIPTION_MAX_LENGTH = 500;
export const MAX_PARTICIPANTS_CAP = 1_000_000;

export function isFollowerMinimum(
  value: number,
): value is (typeof FOLLOWER_MINIMUM_OPTIONS)[number] {
  return (FOLLOWER_MINIMUM_OPTIONS as readonly number[]).includes(value);
}

export function isAccountAgeMinimum(
  value: number,
): value is (typeof ACCOUNT_AGE_MINIMUM_OPTIONS)[number] {
  return (ACCOUNT_AGE_MINIMUM_OPTIONS as readonly number[]).includes(value);
}

/**
 * Campaign duration → minimum pool USD and platform fee USD.
 * Custom hours are not supported.
 */
export const CAMPAIGN_RULES: Record<
  CampaignDuration,
  Omit<CampaignRules, "durationDays">
> = {
  1: { minPoolUsd: 5, feeUsd: 0.2 },
  2: { minPoolUsd: 10, feeUsd: 0.4 },
  3: { minPoolUsd: 20, feeUsd: 0.6 },
  7: { minPoolUsd: 40, feeUsd: 0.95 },
};

export function getCampaignRules(durationDays: CampaignDuration): CampaignRules {
  const rules = CAMPAIGN_RULES[durationDays];
  return {
    durationDays,
    minPoolUsd: rules.minPoolUsd,
    feeUsd: rules.feeUsd,
  };
}

export function isCampaignDuration(value: number): value is CampaignDuration {
  return (CAMPAIGN_DURATION_DAYS as readonly number[]).includes(value);
}

export function isTaskType(value: string): value is TaskType {
  return (TASK_TYPES as readonly string[]).includes(value);
}

export function isRewardToken(value: string): value is RewardToken {
  return (REWARD_TOKENS as readonly string[]).includes(value);
}

/** Identifiable off-chain verification test task. Not a funded campaign. */
export const T2E_TEST_TASK_TITLE = "TEST — Task2Earn Verification";
export const T2E_TEST_TASK_TITLE_PREFIX = "TEST —";
export const T2E_TEST_TASK_ID = "c0ffee00-4e21-4000-8000-00000000e401";
export const T2E_TEST_CREATOR_WALLET =
  "0x0000000000000000000000000000000000000001";

export function isTask2EarnTestTask(task: { title?: string | null }): boolean {
  return Boolean(task.title?.startsWith(T2E_TEST_TASK_TITLE_PREFIX));
}

export function filterMarketplaceTasks<T extends { title: string }>(
  tasks: T[],
  showTestTasks: boolean,
): T[] {
  if (showTestTasks) {
    return tasks;
  }
  return tasks.filter((task) => !isTask2EarnTestTask(task));
}

/** Vercel Production, or any `next start` / production Node build. */
export function isProductionRuntime(): boolean {
  return (
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production"
  );
}

export function resolveShowTestTasksInMarketplace(params: {
  envEnabled: boolean;
  production: boolean;
}): boolean {
  if (params.production) {
    return false;
  }
  return params.envEnabled;
}

export function resolveTestSeedEnabled(params: {
  envEnabled: boolean;
  production: boolean;
}): boolean {
  if (params.production) {
    return false;
  }
  return params.envEnabled;
}

export function shouldShowTestTasksInMarketplace(): boolean {
  return resolveShowTestTasksInMarketplace({
    envEnabled: process.env.T2E_SHOW_TEST_TASKS === "true",
    production: isProductionRuntime(),
  });
}

export function isTestSeedEnabled(): boolean {
  return resolveTestSeedEnabled({
    envEnabled: process.env.T2E_ALLOW_TEST_SEED === "true",
    production: isProductionRuntime(),
  });
}

/**
 * Equal-split concept: pool / verified participants.
 * Returns null when there are no verified participants.
 * Does not send tokens or write accounting rows.
 */
export function calculateEqualSplitAmount(
  poolAmount: number,
  verifiedParticipantCount: number,
): number | null {
  if (
    !Number.isFinite(poolAmount) ||
    poolAmount < 0 ||
    !Number.isFinite(verifiedParticipantCount) ||
    verifiedParticipantCount <= 0
  ) {
    return null;
  }
  return poolAmount / verifiedParticipantCount;
}
