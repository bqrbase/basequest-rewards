import type { QuestId } from "@/lib/quest-engine";

export type AchievementCategoryId =
  | "getting-started"
  | "trading"
  | "bridge"
  | "builder"
  | "nft"
  | "defi"
  | "community";

export type AchievementStatus = "locked" | "in_progress" | "completed";

/**
 * How progress is derived today. `future` leaves the card ready for a later
 * data source without touching the quest engine.
 */
export type AchievementProgressRule =
  | { kind: "quest"; questId: QuestId }
  | { kind: "quests_all"; questIds: QuestId[] }
  | { kind: "streak"; target: number }
  | { kind: "xp"; target: number }
  | { kind: "quest_count"; target: number }
  | { kind: "future"; target?: number };

export type AchievementDefinition = {
  id: string;
  category: AchievementCategoryId;
  title: string;
  description: string;
  rewardXp: number;
  /** Short visual mark (emoji) for the card icon */
  icon: string;
  progress: AchievementProgressRule;
};

export type BadgeDefinition = {
  id: string;
  title: string;
  description: string;
  icon: string;
  /** All listed achievements must be completed to unlock */
  requires: string[];
};

export type AchievementViewModel = AchievementDefinition & {
  status: AchievementStatus;
  current: number;
  target: number;
  percent: number;
};

export type BadgeViewModel = BadgeDefinition & {
  unlocked: boolean;
  unlockedCount: number;
  requiredCount: number;
};

export type AchievementCategoryMeta = {
  id: AchievementCategoryId;
  label: string;
  description: string;
};

export type AchievementSummary = {
  total: number;
  completed: number;
  inProgress: number;
  locked: number;
  percent: number;
  earnedXp: number;
  badgesUnlocked: number;
  badgesTotal: number;
};
