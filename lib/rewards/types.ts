import type { QuestId } from "@/lib/quest-engine";

/**
 * Supported reward actions for the BQR rewards service.
 * XP and on-chain claims are out of scope for this module.
 */
export type RewardActionId =
  | "connect-wallet"
  | "daily-check-in"
  | "referral"
  | QuestId
  | `future:${string}`;

export type RewardKind = "wallet" | "quest" | "referral" | "future";

/**
 * Catalog entry — amounts are whole BQR tokens (not wei).
 * Claim / transfer layers convert with token decimals later.
 */
export type RewardDefinition = {
  actionId: RewardActionId;
  kind: RewardKind;
  label: string;
  description: string;
  /** Whole BQR tokens awarded when eligible (per unit for referrals). */
  amountBqr: number;
  /** When kind === "quest", the quest that gates eligibility. */
  questId?: QuestId;
  /**
   * `one_time` — eligible once after requirement is met.
   * `per_referral` — amountBqr × unclaimed successful referrals.
   * `future` — reserved; never eligible until activated.
   */
  grantMode: "one_time" | "per_referral" | "future";
};

export type RewardEligibilityStatus =
  | "eligible"
  | "ineligible"
  | "already_claimed"
  | "reserved";

export type EligibleReward = {
  actionId: RewardActionId;
  kind: RewardKind;
  label: string;
  amountBqr: number;
  status: RewardEligibilityStatus;
  /** Units contributing to amount (e.g. referral count). */
  units: number;
  reason: string;
};

/**
 * Pure input snapshot — callers supply state; this module never reads wallets,
 * Supabase, or the quest engine mutably.
 */
export type RewardEligibilityInput = {
  isWalletConnected: boolean;
  /** Quest IDs the user has completed (from existing progress). */
  completedQuestIds: readonly QuestId[];
  /** Successful (completed) referrals attributed to this user as referrer. */
  successfulReferralCount: number;
  /**
   * Action IDs already claimed via a future claim flow.
   * Leave empty until Claim integration exists.
   */
  claimedActionIds?: readonly RewardActionId[];
  /**
   * Successful referrals already paid out via a future claim flow.
   * Defaults to 0 (all successful referrals still pending).
   */
  claimedReferralCount?: number;
};

export type PendingRewardsResult = {
  items: EligibleReward[];
  /** Sum of amountBqr for status === "eligible" only. */
  totalPendingBqr: number;
  eligibleCount: number;
};
