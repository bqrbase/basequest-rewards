import { mergeCompletedQuestsForDb } from "@/lib/quests/deployContractDailyReward";
import type { QuestProgress } from "@/lib/quest-engine";
import {
  fetchOrCreateUserAdmin,
  saveUserProgressAdmin,
} from "@/lib/supabase/usersServer";
import { userRowToProgress } from "@/lib/supabase/users";
import { isHash } from "viem";

/** Exact XP awarded for each distinct confirmed JesseCat mint transaction. */
export const JESSECAT_MINT_REWARD_XP = 100;

/** Stored in users.completed_quests — not a one-time quest id. */
export const JESSECAT_MINT_TX_PREFIX = "jessecat-mint:" as const;

export function normalizeJesseCatMintTxHash(txHash: string): string | null {
  const trimmed = txHash.trim().toLowerCase();
  return isHash(trimmed) ? trimmed : null;
}

export function jessecatMintTxMarker(txHash: string): string | null {
  const normalized = normalizeJesseCatMintTxHash(txHash);
  return normalized ? `${JESSECAT_MINT_TX_PREFIX}${normalized}` : null;
}

export function listJesseCatMintTxMarkers(completedQuests: unknown): string[] {
  if (!Array.isArray(completedQuests)) {
    return [];
  }

  return completedQuests.filter(
    (id): id is string =>
      typeof id === "string" && id.startsWith(JESSECAT_MINT_TX_PREFIX),
  );
}

export function hasJesseCatMintRewardForTx(
  completedQuests: unknown,
  txHash: string,
): boolean {
  const marker = jessecatMintTxMarker(txHash);
  if (!marker) {
    return false;
  }
  return listJesseCatMintTxMarkers(completedQuests).includes(marker);
}

export type AwardJesseCatMintXpResult = {
  progress: QuestProgress;
  alreadyAwarded: boolean;
  awardedXP: number;
};

/**
 * Repeatable JesseCat XP: +100 per confirmed mint tx hash.
 * Never adds "jessecat-mint" to completedQuestIds, so the card stays available.
 */
export async function awardJesseCatMintXp(params: {
  walletAddress: string;
  txHash: string;
}): Promise<AwardJesseCatMintXpResult> {
  const marker = jessecatMintTxMarker(params.txHash);
  if (!marker) {
    throw new Error("A valid transaction hash is required.");
  }

  const user = await fetchOrCreateUserAdmin(params.walletAddress);
  const progress: QuestProgress = user
    ? userRowToProgress(user)
    : {
        totalXp: 0,
        streak: 0,
        lastCheckInDate: null,
        completedQuestIds: [],
      };
  const existingCompletedQuests = user?.completed_quests ?? [];

  if (hasJesseCatMintRewardForTx(existingCompletedQuests, params.txHash)) {
    return {
      progress,
      alreadyAwarded: true,
      awardedXP: 0,
    };
  }

  const nextProgress: QuestProgress = {
    ...progress,
    totalXp: progress.totalXp + JESSECAT_MINT_REWARD_XP,
  };

  const completedQuestsForDb = mergeCompletedQuestsForDb({
    questIds: nextProgress.completedQuestIds,
    existingCompletedQuests,
    extraMarkers: [marker],
  });

  await saveUserProgressAdmin(params.walletAddress, nextProgress, {
    completedQuestsOverride: completedQuestsForDb,
  });

  return {
    progress: nextProgress,
    alreadyAwarded: false,
    awardedXP: JESSECAT_MINT_REWARD_XP,
  };
}
