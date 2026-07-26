export {
  ACHIEVEMENT_CATEGORIES,
  ACHIEVEMENT_DEFINITIONS,
  BADGE_DEFINITIONS,
} from "@/lib/achievements/catalog";
export {
  deriveAchievements,
  deriveBadges,
  groupAchievementsByCategory,
  summarizeAchievements,
} from "@/lib/achievements/derive";
export type {
  AchievementCategoryId,
  AchievementCategoryMeta,
  AchievementDefinition,
  AchievementStatus,
  AchievementSummary,
  AchievementViewModel,
  BadgeDefinition,
  BadgeViewModel,
} from "@/lib/achievements/types";
