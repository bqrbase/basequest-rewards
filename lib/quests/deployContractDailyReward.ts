import { getUtcTodayDateString, QUEST_IDS, type QuestId } from "@/lib/quest-engine";

/** Stored in users.completed_quests alongside real quest ids. */
export const DEPLOY_CONTRACT_DAILY_PREFIX = "deploy-contract:" as const;

/** JesseCat mint tx-hash markers — keep in sync with jessecatMintReward.ts. */
const JESSECAT_MINT_TX_PREFIX = "jessecat-mint:" as const;

export function deployContractDailyMarker(utcDate = getUtcTodayDateString()) {
  return `${DEPLOY_CONTRACT_DAILY_PREFIX}${utcDate}`;
}

export function listDeployContractDailyMarkers(
  completedQuests: unknown,
): string[] {
  if (!Array.isArray(completedQuests)) {
    return [];
  }

  return completedQuests.filter(
    (id): id is string =>
      typeof id === "string" && id.startsWith(DEPLOY_CONTRACT_DAILY_PREFIX),
  );
}

export function hasDeployContractRewardOnUtcDay(
  completedQuests: unknown,
  utcDate = getUtcTodayDateString(),
): boolean {
  return listDeployContractDailyMarkers(completedQuests).includes(
    deployContractDailyMarker(utcDate),
  );
}

function listPreservedRewardMarkers(completedQuests: unknown): string[] {
  if (!Array.isArray(completedQuests)) {
    return [];
  }

  return completedQuests.filter(
    (id): id is string =>
      typeof id === "string" &&
      (id.startsWith(DEPLOY_CONTRACT_DAILY_PREFIX) ||
        id.startsWith(JESSECAT_MINT_TX_PREFIX)),
  );
}

/**
 * Merge engine quest ids with preserved reward markers for DB writes.
 * Prevents other progress saves from wiping deploy-day or JesseCat tx markers.
 */
export function mergeCompletedQuestsForDb(params: {
  questIds: QuestId[];
  existingCompletedQuests: unknown;
  extraMarkers?: string[];
}): string[] {
  const preservedMarkers = listPreservedRewardMarkers(
    params.existingCompletedQuests,
  );
  const extras = params.extraMarkers ?? [];

  const questIds = params.questIds.filter((id) => QUEST_IDS.includes(id));

  return Array.from(
    new Set<string>([...questIds, ...preservedMarkers, ...extras]),
  );
}
