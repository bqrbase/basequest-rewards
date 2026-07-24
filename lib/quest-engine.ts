export type QuestId =
  | "daily-check-in"
  | "view-leaderboard"
  | "build-streak"
  | "explore-base"
  | "follow-x"
  | "follow-farcaster"
  | "deploy-contract"
  | "claim-nft";

const QUEST_IDS: QuestId[] = [
  "daily-check-in",
  "view-leaderboard",
  "build-streak",
  "explore-base",
  "follow-x",
  "follow-farcaster",
  "deploy-contract",
  "claim-nft",
];

/** Quests shown in Community section (excluded from Builder lists). */
export const COMMUNITY_ENGINE_QUEST_IDS: QuestId[] = [
  "follow-x",
  "follow-farcaster",
];

/** Builder quests rendered by dedicated UI (excluded from generic builder map). */
export const SPECIAL_BUILDER_QUEST_IDS: QuestId[] = [
  "deploy-contract",
  "claim-nft",
];

export function isCommunityEngineQuest(questId: QuestId): boolean {
  return COMMUNITY_ENGINE_QUEST_IDS.includes(questId);
}

export function isSpecialBuilderQuest(questId: QuestId): boolean {
  return SPECIAL_BUILDER_QUEST_IDS.includes(questId);
}

export function parseQuestIds(ids: unknown): QuestId[] {
  if (!Array.isArray(ids)) {
    return [];
  }

  return ids.filter(
    (id): id is QuestId =>
      typeof id === "string" && QUEST_IDS.includes(id as QuestId),
  );
}

export type QuestStatus = "available" | "completed" | "locked";

export type QuestProgress = {
  totalXp: number;
  streak: number;
  lastCheckInDate: string | null;
  completedQuestIds: QuestId[];
};

export type QuestDefinition = {
  id: QuestId;
  title: string;
  description: string;
  rewardXp: number;
  prerequisites: QuestId[];
  ctaAvailable: string;
};

export type QuestCatalogRow = {
  id: string;
  title: string;
  description: string;
  reward_xp: number;
};

export const STORAGE_KEY = "basequest-progress";

const QUEST_ENGINE_METADATA: Record<
  QuestId,
  Pick<QuestDefinition, "prerequisites" | "ctaAvailable">
> = {
  "daily-check-in": {
    prerequisites: [],
    ctaAvailable: "Check In",
  },
  "view-leaderboard": {
    prerequisites: [],
    ctaAvailable: "Open Leaderboard",
  },
  "build-streak": {
    prerequisites: ["daily-check-in"],
    ctaAvailable: "View Streak",
  },
  "explore-base": {
    prerequisites: ["daily-check-in"],
    ctaAvailable: "Explore Apps",
  },
  "follow-x": {
    prerequisites: [],
    ctaAvailable: "Connect X",
  },
  "follow-farcaster": {
    prerequisites: [],
    ctaAvailable: "Follow @hqc",
  },
  "deploy-contract": {
    prerequisites: [],
    ctaAvailable: "Deploy Contract",
  },
  "claim-nft": {
    prerequisites: ["deploy-contract"],
    ctaAvailable: "Claim NFT",
  },
};

export const QUEST_DEFINITIONS: QuestDefinition[] = [
  {
    id: "daily-check-in",
    title: "Daily Check-in",
    description:
      "Check in once per day to earn rewards and keep your streak alive.",
    rewardXp: 10,
    ...QUEST_ENGINE_METADATA["daily-check-in"],
  },
  {
    id: "view-leaderboard",
    title: "View Leaderboard",
    description: "Open the leaderboard for the first time.",
    rewardXp: 25,
    ...QUEST_ENGINE_METADATA["view-leaderboard"],
  },
  {
    id: "build-streak",
    title: "Build Your Streak",
    description:
      "Return daily to grow your streak and unlock bonus engagement rewards.",
    rewardXp: 5,
    ...QUEST_ENGINE_METADATA["build-streak"],
  },
  {
    id: "explore-base",
    title: "Explore Base Apps",
    description:
      "Discover popular apps in the Base ecosystem and earn bonus XP.",
    rewardXp: 15,
    ...QUEST_ENGINE_METADATA["explore-base"],
  },
  {
    id: "follow-x",
    title: "Follow us on X",
    description:
      "Follow @bqrbase on X to stay updated with BaseQuest Rewards.",
    rewardXp: 25,
    ...QUEST_ENGINE_METADATA["follow-x"],
  },
  {
    id: "follow-farcaster",
    title: "Follow us on Farcaster",
    description:
      "Follow @hqc on Farcaster and join the BaseQuest community.",
    rewardXp: 25,
    ...QUEST_ENGINE_METADATA["follow-farcaster"],
  },
  {
    id: "deploy-contract",
    title: "Deploy Contract",
    description:
      "Choose a contract template and deploy your first contract on Base.",
    rewardXp: 50,
    ...QUEST_ENGINE_METADATA["deploy-contract"],
  },
  {
    id: "claim-nft",
    title: "Claim NFT",
    description:
      "Mint your BaseQuest Builder Badge NFT after deploying your first contract.",
    rewardXp: 50,
    ...QUEST_ENGINE_METADATA["claim-nft"],
  },
];

function resolveQuestDefinitions(
  definitions?: QuestDefinition[],
): QuestDefinition[] {
  if (definitions && definitions.length > 0) {
    return definitions;
  }

  return QUEST_DEFINITIONS;
}

function findQuestDefinition(
  questId: QuestId,
  definitions?: QuestDefinition[],
): QuestDefinition | undefined {
  return resolveQuestDefinitions(definitions).find(
    (quest) => quest.id === questId,
  );
}

export function buildQuestDefinitionsFromCatalog(
  rows: QuestCatalogRow[],
): QuestDefinition[] {
  const fromCatalog = new Map<QuestId, QuestDefinition>();

  for (const row of rows) {
    if (!QUEST_IDS.includes(row.id as QuestId)) {
      continue;
    }

    const questId = row.id as QuestId;
    const metadata = QUEST_ENGINE_METADATA[questId];

    fromCatalog.set(questId, {
      id: questId,
      title: row.title,
      description: row.description,
      rewardXp: row.reward_xp,
      prerequisites: metadata.prerequisites,
      ctaAvailable: metadata.ctaAvailable,
    });
  }

  // Keep local defaults (including community quests) when catalog omits them.
  return QUEST_DEFINITIONS.map(
    (definition) => fromCatalog.get(definition.id) ?? definition,
  );
}

export function getDefaultProgress(): QuestProgress {
  return {
    totalXp: 0,
    streak: 0,
    lastCheckInDate: null,
    completedQuestIds: [],
  };
}

export function getTodayDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function normalizeCheckInDate(
  value: string | null | undefined,
): string | null {
  if (!value) {
    return null;
  }

  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

function getPreviousDateString(dateString: string): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() - 1);
  return getTodayDateString(date);
}

export function normalizeStreak(
  progress: QuestProgress,
  today = getTodayDateString(),
): QuestProgress {
  const lastCheckInDate = normalizeCheckInDate(progress.lastCheckInDate);

  if (!lastCheckInDate) {
    return progress.streak === 0 && progress.lastCheckInDate === null
      ? progress
      : { ...progress, lastCheckInDate: null, streak: 0 };
  }

  const normalizedProgress =
    lastCheckInDate === progress.lastCheckInDate
      ? progress
      : { ...progress, lastCheckInDate };

  const yesterday = getPreviousDateString(today);
  if (lastCheckInDate === today || lastCheckInDate === yesterday) {
    return normalizedProgress;
  }

  return { ...normalizedProgress, streak: 0 };
}

export function getProgressStorageKey(walletAddress?: string | null): string {
  if (!walletAddress) {
    return `${STORAGE_KEY}:guest`;
  }

  return `${STORAGE_KEY}:${walletAddress.toLowerCase()}`;
}

export function loadProgress(walletAddress?: string | null): QuestProgress {
  if (typeof window === "undefined") {
    return getDefaultProgress();
  }

  try {
    const storageKey = getProgressStorageKey(walletAddress);
    let raw = window.localStorage.getItem(storageKey);

    if (!raw && !walletAddress) {
      raw = window.localStorage.getItem(STORAGE_KEY);
    }

    if (!raw) {
      return getDefaultProgress();
    }

    const parsed = JSON.parse(raw) as Partial<QuestProgress>;
    return {
      totalXp: parsed.totalXp ?? 0,
      streak: parsed.streak ?? 0,
      lastCheckInDate: normalizeCheckInDate(parsed.lastCheckInDate),
      completedQuestIds: parseQuestIds(parsed.completedQuestIds),
    };
  } catch {
    return getDefaultProgress();
  }
}

export function saveProgress(
  progress: QuestProgress,
  walletAddress?: string | null,
): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    getProgressStorageKey(walletAddress),
    JSON.stringify(progress),
  );
}

function hasCompletedQuest(progress: QuestProgress, questId: QuestId): boolean {
  return progress.completedQuestIds.includes(questId);
}

function prerequisitesMet(
  progress: QuestProgress,
  prerequisites: QuestId[],
): boolean {
  return prerequisites.every((questId) => hasCompletedQuest(progress, questId));
}

export function getQuestStatus(
  questId: QuestId,
  progress: QuestProgress,
  today = getTodayDateString(),
  definitions?: QuestDefinition[],
): QuestStatus {
  const definition = findQuestDefinition(questId, definitions);
  if (!definition) {
    return "locked";
  }

  if (!prerequisitesMet(progress, definition.prerequisites)) {
    return "locked";
  }

  if (questId === "daily-check-in") {
    return normalizeCheckInDate(progress.lastCheckInDate) === today
      ? "completed"
      : "available";
  }

  return hasCompletedQuest(progress, questId) ? "completed" : "available";
}

export function getQuestCtaLabel(
  questId: QuestId,
  progress: QuestProgress,
  today = getTodayDateString(),
  definitions?: QuestDefinition[],
): string {
  const status = getQuestStatus(questId, progress, today, definitions);
  const definition = findQuestDefinition(questId, definitions);

  if (!definition) {
    return "Locked";
  }

  if (status === "locked") {
    return "Locked";
  }

  if (status === "completed") {
    return "Completed";
  }

  return definition.ctaAvailable;
}

export function performDailyCheckIn(
  progress: QuestProgress,
  today = getTodayDateString(),
  definitions?: QuestDefinition[],
): QuestProgress {
  const lastCheckInDate = normalizeCheckInDate(progress.lastCheckInDate);

  if (lastCheckInDate === today) {
    return progress.lastCheckInDate === today
      ? progress
      : { ...progress, lastCheckInDate: today };
  }

  const rewardXp =
    findQuestDefinition("daily-check-in", definitions)?.rewardXp ?? 10;
  const yesterday = getPreviousDateString(today);
  const nextStreak =
    lastCheckInDate === yesterday ? progress.streak + 1 : 1;

  const completedQuestIds: QuestId[] = hasCompletedQuest(progress, "daily-check-in")
    ? progress.completedQuestIds
    : [...progress.completedQuestIds, "daily-check-in"];

  return {
    totalXp: progress.totalXp + rewardXp,
    streak: nextStreak,
    lastCheckInDate: today,
    completedQuestIds,
  };
}

export function completeOneTimeQuest(
  progress: QuestProgress,
  questId: QuestId,
  definitions?: QuestDefinition[],
): QuestProgress {
  const definition = findQuestDefinition(questId, definitions);
  if (!definition || questId === "daily-check-in") {
    return progress;
  }

  if (getQuestStatus(questId, progress, getTodayDateString(), definitions) !== "available") {
    return progress;
  }

  if (hasCompletedQuest(progress, questId)) {
    return progress;
  }

  return {
    ...progress,
    totalXp: progress.totalXp + definition.rewardXp,
    completedQuestIds: [...progress.completedQuestIds, questId],
  };
}

export function performQuestAction(
  progress: QuestProgress,
  questId: QuestId,
  today = getTodayDateString(),
  definitions?: QuestDefinition[],
): QuestProgress {
  if (questId === "daily-check-in") {
    return performDailyCheckIn(progress, today, definitions);
  }

  return completeOneTimeQuest(progress, questId, definitions);
}

export function getCompletedQuestCount(progress: QuestProgress): number {
  return progress.completedQuestIds.length;
}

export type QuestViewModel = {
  id: QuestId;
  title: string;
  description: string;
  reward: string;
  status: QuestStatus;
  ctaLabel: string;
};

export function getQuestViewModels(
  progress: QuestProgress,
  definitions?: QuestDefinition[],
  today = getTodayDateString(),
): QuestViewModel[] {
  return resolveQuestDefinitions(definitions).map((definition) => ({
    id: definition.id,
    title: definition.title,
    description: definition.description,
    reward: `+${definition.rewardXp} XP`,
    status: getQuestStatus(definition.id, progress, today, definitions),
    ctaLabel: getQuestCtaLabel(definition.id, progress, today, definitions),
  }));
}

export function getProgressStats(progress: QuestProgress) {
  return [
    { label: "Total XP", value: progress.totalXp.toString() },
    { label: "Current Streak", value: `${progress.streak} days` },
    {
      label: "Completed Quests",
      value: getCompletedQuestCount(progress).toString(),
    },
  ];
}
