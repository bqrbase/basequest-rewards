import type { QuestId } from "@/lib/quest-engine";

/** Onboarding quest that unlocks a successful referral reward. */
export const REFERRAL_ONBOARDING_QUEST_ID: QuestId = "daily-check-in";

/** XP awarded to the referrer once the referee finishes onboarding. */
export const REFERRAL_REWARD_XP = 50;

/** localStorage key for a pending invite code captured from ?ref= */
export const REFERRAL_PENDING_CODE_KEY = "basequest-referral-code";

/** Query param used in share links. */
export const REFERRAL_QUERY_PARAM = "ref";
