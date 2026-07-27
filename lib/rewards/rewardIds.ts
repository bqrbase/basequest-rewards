import { encodePacked, keccak256, type Hex } from "viem";
import type { RewardActionId } from "@/lib/rewards/types";

/**
 * Off-chain action keys and on-chain rewardId mapping.
 *
 * - one_time: actionKey === actionId (e.g. "daily-check-in")
 * - referral unit n (1-based): actionKey === `referral:${n}`
 *
 * rewardId = keccak256(abi.encodePacked(string actionKey))
 * Leaf = keccak256(account, rewardId, amount) — no campaignId.
 * Replay claimId = keccak256(campaignId, account, rewardId).
 * Prefer at most one published allocation per (wallet, rewardId) unless a
 * second campaign payout is intentional.
 */

export function referralActionKey(unitIndex: number): string {
  if (!Number.isInteger(unitIndex) || unitIndex < 1) {
    throw new Error("referralActionKey: unitIndex must be a positive integer");
  }
  return `referral:${unitIndex}`;
}

export function isReferralActionKey(actionKey: string): boolean {
  return /^referral:\d+$/.test(actionKey);
}

export function parseReferralUnitIndex(actionKey: string): number | null {
  const match = /^referral:(\d+)$/.exec(actionKey);
  if (!match) {
    return null;
  }
  return Number(match[1]);
}

export function toRewardId(actionKey: string): Hex {
  if (!actionKey || actionKey.trim() !== actionKey || actionKey.length === 0) {
    throw new Error("toRewardId: actionKey must be a non-empty string");
  }
  return keccak256(encodePacked(["string"], [actionKey]));
}

export function oneTimeActionKey(actionId: RewardActionId): string {
  return String(actionId);
}
