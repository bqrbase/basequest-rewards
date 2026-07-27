import { bqrToWei } from "@/lib/rewards/amounts";
import {
  oneTimeActionKey,
  referralActionKey,
  toRewardId,
} from "@/lib/rewards/rewardIds";
import type { EligibleReward } from "@/lib/rewards/types";
import type { Address, Hex } from "viem";

export type PlannedAllocation = {
  wallet: Address;
  actionKey: string;
  rewardId: Hex;
  amountBqr: number;
  amountWei: bigint;
};

/**
 * Expand eligible catalog items into concrete Merkle allocation rows.
 * Referral units become distinct action keys (`referral:n`) for claim uniqueness.
 */
export function expandEligibleToAllocations(params: {
  wallet: string;
  eligibleItems: readonly EligibleReward[];
  /** Highest referral unit already allocated in prior campaigns. */
  priorReferralUnitMax: number;
  /** Action keys already allocated (one_time) in prior campaigns. */
  priorActionKeys: ReadonlySet<string>;
  decimals: number;
}): PlannedAllocation[] {
  const wallet = params.wallet.toLowerCase() as Address;
  const out: PlannedAllocation[] = [];

  for (const item of params.eligibleItems) {
    if (item.status !== "eligible" || item.amountBqr <= 0 || item.units <= 0) {
      continue;
    }

    if (item.kind === "referral" || item.actionId === "referral") {
      for (let i = 1; i <= item.units; i += 1) {
        const unitIndex = params.priorReferralUnitMax + i;
        const actionKey = referralActionKey(unitIndex);
        if (params.priorActionKeys.has(actionKey)) {
          continue;
        }
        const amountBqr = item.amountBqr / item.units;
        out.push({
          wallet,
          actionKey,
          rewardId: toRewardId(actionKey),
          amountBqr,
          amountWei: bqrToWei(amountBqr, params.decimals),
        });
      }
      continue;
    }

    const actionKey = oneTimeActionKey(item.actionId);
    if (params.priorActionKeys.has(actionKey)) {
      continue;
    }

    out.push({
      wallet,
      actionKey,
      rewardId: toRewardId(actionKey),
      amountBqr: item.amountBqr,
      amountWei: bqrToWei(item.amountBqr, params.decimals),
    });
  }

  return out;
}
