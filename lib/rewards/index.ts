/**
 * Rewards Service — eligibility & catalog only.
 *
 * Does NOT send tokens, create txs, call contracts, transfer BQR, or modify XP.
 * Future Claim integration should call these pure helpers, then perform payouts
 * in a separate module.
 */

export {
  getRewardDefinition,
  getRewardDefinitionForQuest,
  listRewardDefinitions,
  REWARD_DEFINITIONS,
} from "@/lib/rewards/catalog";
export {
  calculatePendingRewards,
  evaluateRewardEligibility,
  getRewardForQuest,
  getRewardForReferral,
} from "@/lib/rewards/service";
export type {
  EligibleReward,
  PendingRewardsResult,
  RewardActionId,
  RewardDefinition,
  RewardEligibilityInput,
  RewardEligibilityStatus,
  RewardKind,
} from "@/lib/rewards/types";
