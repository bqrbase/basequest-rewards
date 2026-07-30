import {
  GENESIS_XP_BONUS_RATE,
  type GenesisXPAccessInput,
  type GenesisXPBreakdown,
} from "@/lib/genesis/xp/types";

/**
 * Calculate Genesis XP bonus for display.
 *
 * Applies +20% only when `canReceiveGenesisXPBonus === true`.
 * Does not write XP — callers use this for UI only.
 */
export function calculateGenesisXP(
  baseXP: number,
  access: GenesisXPAccessInput,
): GenesisXPBreakdown {
  const safeBase = Number.isFinite(baseXP) && baseXP > 0 ? Math.floor(baseXP) : 0;

  if (!access.canReceiveGenesisXPBonus || safeBase === 0) {
    return {
      baseXP: safeBase,
      bonusXP: 0,
      totalXP: safeBase,
    };
  }

  const bonusXP = Math.floor(safeBase * GENESIS_XP_BONUS_RATE);

  return {
    baseXP: safeBase,
    bonusXP,
    totalXP: safeBase + bonusXP,
  };
}

/** Parse common reward strings like "+50 XP" / "100 XP". */
export function parseRewardXpLabel(reward: string): number | null {
  const match = reward.match(/(\d+)\s*XP/i);
  if (!match) {
    return null;
  }
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}
