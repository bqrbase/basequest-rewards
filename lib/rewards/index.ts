/**
 * Rewards Service — eligibility & catalog (pure).
 *
 * Does NOT send tokens, create txs, call contracts, transfer BQR, or modify XP.
 * Merkle backend / admin APIs live under `lib/rewards/server/*` (server-only).
 * Claim txs use `lib/contracts/claim/rewardsDistributor.ts`.
 *
 * Leaf: keccak256(account, rewardId, amount)
 * claimId: keccak256(campaignId, account, rewardId)
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
export {
  buildMerkleTree,
  claimLeaf,
  hashPair,
} from "@/lib/rewards/merkleTree";
export {
  isReferralActionKey,
  oneTimeActionKey,
  parseReferralUnitIndex,
  referralActionKey,
  toRewardId,
} from "@/lib/rewards/rewardIds";
export { bqrToWei, DEFAULT_BQR_DECIMALS } from "@/lib/rewards/amounts";
export type {
  EligibleReward,
  PendingRewardsResult,
  RewardActionId,
  RewardDefinition,
  RewardEligibilityInput,
  RewardEligibilityStatus,
  RewardKind,
} from "@/lib/rewards/types";
