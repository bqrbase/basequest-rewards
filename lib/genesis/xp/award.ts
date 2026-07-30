import { calculateGenesisXP } from "@/lib/genesis/xp/calculateGenesisXP";
import type { GenesisXPAccessInput } from "@/lib/genesis/xp/types";

/**
 * Convert a base quest XP award into the amount that should be persisted.
 * When Genesis XP bonus is active, awards +20% (floored).
 *
 * This is the server persistence path — not display-only.
 */
export function awardGenesisAdjustedXp(
  baseXP: number,
  access: GenesisXPAccessInput,
): {
  baseXP: number;
  bonusXP: number;
  totalXP: number;
} {
  return calculateGenesisXP(baseXP, access);
}
