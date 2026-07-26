import type { QuestId } from "@/lib/quest-engine";
import {
  getRewardDefinition,
  getRewardDefinitionForQuest,
  listRewardDefinitions,
} from "@/lib/rewards/catalog";
import type {
  EligibleReward,
  PendingRewardsResult,
  RewardDefinition,
  RewardEligibilityInput,
} from "@/lib/rewards/types";

function claimedSet(input: RewardEligibilityInput): Set<string> {
  return new Set(input.claimedActionIds ?? []);
}

function hasCompletedQuest(
  input: RewardEligibilityInput,
  questId: QuestId,
): boolean {
  return input.completedQuestIds.includes(questId);
}

/**
 * Look up the catalog reward for a quest (BQR amount + metadata).
 * Does not check eligibility or mutate state.
 */
export function getRewardForQuest(
  questId: QuestId,
): RewardDefinition | null {
  return getRewardDefinitionForQuest(questId);
}

/**
 * Look up the per-successful-referral BQR reward definition.
 */
export function getRewardForReferral(): RewardDefinition {
  const definition = getRewardDefinition("referral");
  if (!definition) {
    // Catalog always includes referral; keep a safe fallback for typing.
    return {
      actionId: "referral",
      kind: "referral",
      label: "Referral",
      description: "Per successful referral after onboarding.",
      amountBqr: 50,
      grantMode: "per_referral",
    };
  }
  return definition;
}

/**
 * Evaluate a single catalog definition against the caller-supplied snapshot.
 * Pure — no I/O, no XP changes, no chain calls.
 */
export function evaluateRewardEligibility(
  definition: RewardDefinition,
  input: RewardEligibilityInput,
): EligibleReward {
  const claimed = claimedSet(input);

  if (definition.grantMode === "future" || definition.kind === "future") {
    return {
      actionId: definition.actionId,
      kind: definition.kind,
      label: definition.label,
      amountBqr: 0,
      status: "reserved",
      units: 0,
      reason: "Reserved for a future reward; not claimable yet.",
    };
  }

  if (definition.grantMode === "per_referral") {
    const successful = Math.max(0, input.successfulReferralCount);
    const alreadyClaimed = Math.max(0, input.claimedReferralCount ?? 0);
    const pendingUnits = Math.max(0, successful - alreadyClaimed);
    const amountBqr = pendingUnits * definition.amountBqr;

    if (pendingUnits <= 0) {
      return {
        actionId: definition.actionId,
        kind: definition.kind,
        label: definition.label,
        amountBqr: 0,
        status: successful > 0 ? "already_claimed" : "ineligible",
        units: 0,
        reason:
          successful > 0
            ? "All successful referral rewards are already marked claimed."
            : "No successful referrals yet.",
      };
    }

    return {
      actionId: definition.actionId,
      kind: definition.kind,
      label: definition.label,
      amountBqr,
      status: "eligible",
      units: pendingUnits,
      reason: `${pendingUnits} successful referral(s) × ${definition.amountBqr} BQR.`,
    };
  }

  // one_time
  if (claimed.has(definition.actionId)) {
    return {
      actionId: definition.actionId,
      kind: definition.kind,
      label: definition.label,
      amountBqr: 0,
      status: "already_claimed",
      units: 0,
      reason: "Reward already claimed.",
    };
  }

  if (definition.kind === "wallet" && definition.actionId === "connect-wallet") {
    if (!input.isWalletConnected) {
      return {
        actionId: definition.actionId,
        kind: definition.kind,
        label: definition.label,
        amountBqr: 0,
        status: "ineligible",
        units: 0,
        reason: "Wallet is not connected.",
      };
    }
    return {
      actionId: definition.actionId,
      kind: definition.kind,
      label: definition.label,
      amountBqr: definition.amountBqr,
      status: "eligible",
      units: 1,
      reason: "Wallet connected; reward not yet claimed.",
    };
  }

  if (definition.kind === "quest" && definition.questId) {
    if (!hasCompletedQuest(input, definition.questId)) {
      return {
        actionId: definition.actionId,
        kind: definition.kind,
        label: definition.label,
        amountBqr: 0,
        status: "ineligible",
        units: 0,
        reason: `Quest "${definition.questId}" is not completed.`,
      };
    }
    return {
      actionId: definition.actionId,
      kind: definition.kind,
      label: definition.label,
      amountBqr: definition.amountBqr,
      status: "eligible",
      units: 1,
      reason: `Quest "${definition.questId}" completed; reward not yet claimed.`,
    };
  }

  return {
    actionId: definition.actionId,
    kind: definition.kind,
    label: definition.label,
    amountBqr: 0,
    status: "ineligible",
    units: 0,
    reason: "No matching eligibility rule.",
  };
}

/**
 * Calculate all pending (eligible, unclaimed) BQR rewards from a state snapshot.
 * Safe to call from UI or a future Claim service without side effects.
 */
export function calculatePendingRewards(
  input: RewardEligibilityInput,
): PendingRewardsResult {
  const items = listRewardDefinitions().map((definition) =>
    evaluateRewardEligibility(definition, input),
  );

  const eligible = items.filter((item) => item.status === "eligible");
  const totalPendingBqr = eligible.reduce(
    (sum, item) => sum + item.amountBqr,
    0,
  );

  return {
    items,
    totalPendingBqr,
    eligibleCount: eligible.length,
  };
}
