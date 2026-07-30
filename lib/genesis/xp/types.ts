/**
 * Genesis XP bonus — display/calculation only.
 * Does not mutate stored XP, quest completion, or claiming.
 */

export type GenesisXPAccessInput = {
  canReceiveGenesisXPBonus: boolean;
};

export type GenesisXPBreakdown = {
  baseXP: number;
  bonusXP: number;
  totalXP: number;
};

/** Genesis holders receive +20% XP (display layer only until persistence lands). */
export const GENESIS_XP_BONUS_RATE = 0.2;
