import {
  ACHIEVEMENT_DEFINITIONS,
  BADGE_DEFINITIONS,
} from "@/lib/achievements/catalog";
import type {
  AchievementDefinition,
  AchievementStatus,
  AchievementSummary,
  AchievementViewModel,
  BadgeViewModel,
} from "@/lib/achievements/types";
import type { QuestId, QuestProgress, QuestViewModel } from "@/lib/quest-engine";

type ProgressSignals = {
  totalXp: number;
  streak: number;
  completedQuestIds: Set<QuestId>;
  questStatusById: Map<QuestId, QuestViewModel["status"]>;
};

function clampPercent(current: number, target: number): number {
  if (target <= 0) {
    return current > 0 ? 100 : 0;
  }
  return Math.min(100, Math.round((current / target) * 100));
}

function resolveProgress(
  definition: AchievementDefinition,
  signals: ProgressSignals,
): { current: number; target: number; status: AchievementStatus } {
  const rule = definition.progress;

  switch (rule.kind) {
    case "quest": {
      const questStatus = signals.questStatusById.get(rule.questId);
      const completed = signals.completedQuestIds.has(rule.questId);
      if (completed || questStatus === "completed") {
        return { current: 1, target: 1, status: "completed" };
      }
      if (questStatus === "available") {
        return { current: 0, target: 1, status: "in_progress" };
      }
      return { current: 0, target: 1, status: "locked" };
    }
    case "quests_all": {
      const target = rule.questIds.length;
      const current = rule.questIds.filter((id) =>
        signals.completedQuestIds.has(id),
      ).length;
      if (current >= target && target > 0) {
        return { current: target, target, status: "completed" };
      }
      if (current > 0) {
        return { current, target, status: "in_progress" };
      }
      const anyAvailable = rule.questIds.some(
        (id) => signals.questStatusById.get(id) === "available",
      );
      return {
        current,
        target,
        status: anyAvailable ? "in_progress" : "locked",
      };
    }
    case "streak": {
      const current = Math.min(signals.streak, rule.target);
      if (signals.streak >= rule.target) {
        return { current: rule.target, target: rule.target, status: "completed" };
      }
      if (signals.streak > 0) {
        return { current, target: rule.target, status: "in_progress" };
      }
      return { current: 0, target: rule.target, status: "locked" };
    }
    case "xp": {
      const current = Math.min(signals.totalXp, rule.target);
      if (signals.totalXp >= rule.target) {
        return { current: rule.target, target: rule.target, status: "completed" };
      }
      if (signals.totalXp > 0) {
        return { current, target: rule.target, status: "in_progress" };
      }
      return { current: 0, target: rule.target, status: "locked" };
    }
    case "quest_count": {
      const completedCount = signals.completedQuestIds.size;
      const current = Math.min(completedCount, rule.target);
      if (completedCount >= rule.target) {
        return { current: rule.target, target: rule.target, status: "completed" };
      }
      if (completedCount > 0) {
        return { current, target: rule.target, status: "in_progress" };
      }
      return { current: 0, target: rule.target, status: "locked" };
    }
    case "future": {
      const target = rule.target ?? 1;
      return { current: 0, target, status: "locked" };
    }
    default: {
      return { current: 0, target: 1, status: "locked" };
    }
  }
}

/**
 * Derive achievement view models from existing quest progress.
 * Safe to swap later for a dedicated achievements API/table.
 */
export function deriveAchievements(
  progress: Pick<QuestProgress, "totalXp" | "streak" | "completedQuestIds">,
  quests: QuestViewModel[],
  definitions: AchievementDefinition[] = ACHIEVEMENT_DEFINITIONS,
): AchievementViewModel[] {
  const signals: ProgressSignals = {
    totalXp: progress.totalXp,
    streak: progress.streak,
    completedQuestIds: new Set(progress.completedQuestIds),
    questStatusById: new Map(quests.map((quest) => [quest.id, quest.status])),
  };

  return definitions.map((definition) => {
    const resolved = resolveProgress(definition, signals);
    return {
      ...definition,
      status: resolved.status,
      current: resolved.current,
      target: resolved.target,
      percent: clampPercent(resolved.current, resolved.target),
    };
  });
}

export function deriveBadges(
  achievements: AchievementViewModel[],
  definitions = BADGE_DEFINITIONS,
): BadgeViewModel[] {
  const completedIds = new Set(
    achievements
      .filter((item) => item.status === "completed")
      .map((item) => item.id),
  );

  return definitions.map((badge) => {
    const unlockedCount = badge.requires.filter((id) =>
      completedIds.has(id),
    ).length;
    return {
      ...badge,
      unlocked: unlockedCount >= badge.requires.length && badge.requires.length > 0,
      unlockedCount,
      requiredCount: badge.requires.length,
    };
  });
}

export function summarizeAchievements(
  achievements: AchievementViewModel[],
  badges: BadgeViewModel[],
): AchievementSummary {
  const total = achievements.length;
  const completed = achievements.filter((a) => a.status === "completed").length;
  const inProgress = achievements.filter(
    (a) => a.status === "in_progress",
  ).length;
  const locked = achievements.filter((a) => a.status === "locked").length;
  const earnedXp = achievements
    .filter((a) => a.status === "completed")
    .reduce((sum, a) => sum + a.rewardXp, 0);
  const badgesUnlocked = badges.filter((b) => b.unlocked).length;

  return {
    total,
    completed,
    inProgress,
    locked,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
    earnedXp,
    badgesUnlocked,
    badgesTotal: badges.length,
  };
}

export function groupAchievementsByCategory(
  achievements: AchievementViewModel[],
) {
  const groups = new Map<
    AchievementViewModel["category"],
    AchievementViewModel[]
  >();

  for (const achievement of achievements) {
    const list = groups.get(achievement.category) ?? [];
    list.push(achievement);
    groups.set(achievement.category, list);
  }

  return groups;
}
