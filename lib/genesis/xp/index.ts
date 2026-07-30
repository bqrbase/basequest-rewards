/**
 * Genesis XP bonus calculation (display layer).
 * Persistence / claiming remain unchanged in the core quest engine.
 */

export {
  calculateGenesisXP,
  parseRewardXpLabel,
} from "@/lib/genesis/xp/calculateGenesisXP";
export { awardGenesisAdjustedXp } from "@/lib/genesis/xp/award";
export {
  GENESIS_XP_BONUS_RATE,
  type GenesisXPAccessInput,
  type GenesisXPBreakdown,
} from "@/lib/genesis/xp/types";
