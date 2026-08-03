import { resolveServerGenesisAccess } from "@/lib/genesis/holder/server";
import { awardGenesisAdjustedXp } from "@/lib/genesis/xp/award";
import {
  deployContractDailyMarker,
  hasDeployContractRewardOnUtcDay,
  mergeCompletedQuestsForDb,
} from "@/lib/quests/deployContractDailyReward";
import {
  completeOneTimeQuest,
  findQuestDefinition,
  getUtcTodayDateString,
  performDailyCheckIn,
  QUEST_DEFINITIONS,
  type QuestId,
  type QuestProgress,
} from "@/lib/quest-engine";
import {
  fetchOrCreateUserAdmin,
  saveUserProgressAdmin,
} from "@/lib/supabase/usersServer";
import { userRowToProgress } from "@/lib/supabase/users";

export type AwardOneTimeQuestResult = {
  progress: QuestProgress;
  alreadyCompleted: boolean;
  baseXP: number;
  bonusXP: number;
  awardedXP: number;
};

/**
 * Deploy Contract XP: once per UTC day per wallet.
 * Uses completed_quests markers (deploy-contract:YYYY-MM-DD) — no extra column required.
 * Deployments remain unlimited; only the reward is gated.
 */
async function awardDeployContractDailyXp(params: {
  walletAddress: string;
  progress: QuestProgress;
  existingCompletedQuests: unknown;
  baseXP: number;
  bonusXP: number;
  awardedXP: number;
}): Promise<AwardOneTimeQuestResult> {
  const todayUtc = getUtcTodayDateString();

  if (hasDeployContractRewardOnUtcDay(params.existingCompletedQuests, todayUtc)) {
    return {
      progress: params.progress,
      alreadyCompleted: true,
      baseXP: params.baseXP,
      bonusXP: 0,
      awardedXP: 0,
    };
  }

  const completedQuestIds: QuestId[] =
    params.progress.completedQuestIds.includes("deploy-contract")
      ? params.progress.completedQuestIds
      : [...params.progress.completedQuestIds, "deploy-contract"];

  const progress: QuestProgress = {
    ...params.progress,
    totalXp: params.progress.totalXp + params.awardedXP,
    completedQuestIds,
  };

  const completedQuestsForDb = mergeCompletedQuestsForDb({
    questIds: completedQuestIds,
    existingCompletedQuests: params.existingCompletedQuests,
    extraMarkers: [deployContractDailyMarker(todayUtc)],
  });

  try {
    await saveUserProgressAdmin(params.walletAddress, progress, {
      completedQuestsOverride: completedQuestsForDb,
    });
  } catch (progressError) {
    console.error(
      "[awardOneTimeQuest] saveUserProgressAdmin (deploy-contract daily)",
      progressError,
    );
    throw progressError;
  }

  return {
    progress,
    alreadyCompleted: false,
    baseXP: params.baseXP,
    bonusXP: params.bonusXP,
    awardedXP: params.awardedXP,
  };
}

/**
 * Shared server helper: award a quest via the quest engine with Genesis XP
 * bonus applied when the wallet is eligible, then persist via service role.
 */
export async function awardOneTimeQuest(params: {
  walletAddress: string;
  questId: QuestId;
}): Promise<AwardOneTimeQuestResult> {
  const user = await fetchOrCreateUserAdmin(params.walletAddress);
  let progress: QuestProgress = user
    ? userRowToProgress(user)
    : {
        totalXp: 0,
        streak: 0,
        lastCheckInDate: null,
        completedQuestIds: [],
      };

  const alreadyCompleted = progress.completedQuestIds.includes(params.questId);
  const definition = findQuestDefinition(params.questId, QUEST_DEFINITIONS);
  const baseXP = definition?.rewardXp ?? 0;

  if (!definition) {
    return {
      progress,
      alreadyCompleted,
      baseXP: 0,
      bonusXP: 0,
      awardedXP: 0,
    };
  }

  const access = await resolveServerGenesisAccess(params.walletAddress);
  const { bonusXP, totalXP: awardedXP } = awardGenesisAdjustedXp(baseXP, {
    canReceiveGenesisXPBonus: access.canReceiveGenesisXPBonus,
  });

  // Daily check-in is recurring — gate on date, not completedQuestIds alone.
  if (params.questId === "daily-check-in") {
    const beforeXp = progress.totalXp;
    progress = performDailyCheckIn(progress, undefined, QUEST_DEFINITIONS, {
      rewardXpOverride: awardedXP,
    });
    const didAward = progress.totalXp > beforeXp;

    if (didAward) {
      await saveUserProgressAdmin(params.walletAddress, progress);
    }

    return {
      progress,
      alreadyCompleted: !didAward,
      baseXP,
      bonusXP: didAward ? bonusXP : 0,
      awardedXP: didAward ? awardedXP : 0,
    };
  }

  // Deploy Contract: once-per-UTC-day XP; unlimited deployments.
  if (params.questId === "deploy-contract") {
    return awardDeployContractDailyXp({
      walletAddress: params.walletAddress,
      progress,
      existingCompletedQuests: user?.completed_quests ?? [],
      baseXP,
      bonusXP,
      awardedXP,
    });
  }

  if (alreadyCompleted) {
    return {
      progress,
      alreadyCompleted: true,
      baseXP,
      bonusXP: 0,
      awardedXP: 0,
    };
  }

  progress = completeOneTimeQuest(
    progress,
    params.questId,
    QUEST_DEFINITIONS,
    { rewardXpOverride: awardedXP },
  );

  try {
    await saveUserProgressAdmin(params.walletAddress, progress);
  } catch (progressError) {
    console.error(
      `[awardOneTimeQuest] saveUserProgressAdmin (${params.questId})`,
      progressError,
    );
    throw progressError;
  }

  return { progress, alreadyCompleted: false, baseXP, bonusXP, awardedXP };
}

export function progressResponse(progress: QuestProgress) {
  return {
    totalXp: progress.totalXp,
    streak: progress.streak,
    lastCheckInDate: progress.lastCheckInDate,
    completedQuestIds: progress.completedQuestIds,
  };
}
