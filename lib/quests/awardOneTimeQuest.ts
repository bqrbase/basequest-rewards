import {
  completeOneTimeQuest,
  QUEST_DEFINITIONS,
  type QuestId,
  type QuestProgress,
} from "@/lib/quest-engine";
import {
  fetchOrCreateUser,
  saveUserProgress,
  userRowToProgress,
} from "@/lib/supabase/users";

export type AwardOneTimeQuestResult = {
  progress: QuestProgress;
  alreadyCompleted: boolean;
};

/**
 * Shared server helper: award a one-time quest via the existing quest engine
 * and persist to Supabase users.completed_quests / total_xp.
 */
export async function awardOneTimeQuest(params: {
  walletAddress: string;
  questId: QuestId;
}): Promise<AwardOneTimeQuestResult> {
  const user = await fetchOrCreateUser(params.walletAddress);
  let progress: QuestProgress = user
    ? userRowToProgress(user)
    : {
        totalXp: 0,
        streak: 0,
        lastCheckInDate: null,
        completedQuestIds: [],
      };

  const alreadyCompleted = progress.completedQuestIds.includes(params.questId);

  if (!alreadyCompleted) {
    progress = completeOneTimeQuest(
      progress,
      params.questId,
      QUEST_DEFINITIONS,
    );

    try {
      await saveUserProgress(params.walletAddress, progress);
    } catch (progressError) {
      console.error(
        `[awardOneTimeQuest] saveUserProgress (${params.questId})`,
        progressError,
      );
    }
  }

  return { progress, alreadyCompleted };
}

export function progressResponse(progress: QuestProgress) {
  return {
    totalXp: progress.totalXp,
    streak: progress.streak,
    lastCheckInDate: progress.lastCheckInDate,
    completedQuestIds: progress.completedQuestIds,
  };
}
