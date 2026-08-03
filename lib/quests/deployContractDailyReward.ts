import { getUtcTodayDateString, QUEST_IDS, type QuestId } from "@/lib/quest-engine";

/** Stored in users.completed_quests alongside real quest ids. */
export const DEPLOY_CONTRACT_DAILY_PREFIX = "deploy-contract:" as const;

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

/**
 * Merge engine quest ids with preserved daily-reward markers for DB writes.
 * Prevents other progress saves from wiping once-per-day deploy markers.
 */
export function mergeCompletedQuestsForDb(params: {
  questIds: QuestId[];
  existingCompletedQuests: unknown;
  extraMarkers?: string[];
}): string[] {
  const preservedMarkers = listDeployContractDailyMarkers(
    params.existingCompletedQuests,
  );
  const extras = params.extraMarkers ?? [];

  const questIds = params.questIds.filter((id) => QUEST_IDS.includes(id));

  return Array.from(
    new Set<string>([...questIds, ...preservedMarkers, ...extras]),
  );
}
