import type { QuestProgress } from "@/lib/quest-engine";

export const JESSECAT_MINTED_XP_TITLE = "JesseCat minted! +100 XP";
export const JESSECAT_ALREADY_REWARDED_MESSAGE =
  "JesseCat already rewarded for this transaction.";

export type JesseCatMintCompleteJson = {
  success?: boolean;
  alreadyAwarded?: boolean;
  awardedXP?: number;
  progress?: QuestProgress;
};

export type JesseCatMintSuccessFeedback = {
  title: string;
  description: string;
  applyProgress: QuestProgress | null;
  showAwardedXp: boolean;
};

/**
 * Maps the JesseCat complete API payload to success-modal copy.
 * Never locally adds XP — callers must apply `applyProgress` as returned.
 */
export function resolveJesseCatMintSuccessFeedback(
  json: JesseCatMintCompleteJson | null | undefined,
): JesseCatMintSuccessFeedback {
  const progress = json?.progress ?? null;
  const awardedXP = typeof json?.awardedXP === "number" ? json.awardedXP : 0;

  if (json?.success === true && awardedXP > 0 && json.alreadyAwarded !== true) {
    return {
      title: JESSECAT_MINTED_XP_TITLE,
      description: "Your mint transaction was confirmed on Base Mainnet.",
      applyProgress: progress,
      showAwardedXp: true,
    };
  }

  if (json?.success === true) {
    return {
      title: "JesseCat minted",
      description: JESSECAT_ALREADY_REWARDED_MESSAGE,
      applyProgress: progress,
      showAwardedXp: false,
    };
  }

  return {
    title: "JesseCat minted",
    description: "Your mint transaction was submitted on Base Mainnet.",
    applyProgress: progress,
    showAwardedXp: false,
  };
}
