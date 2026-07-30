/**
 * Genesis holder system foundation.
 *
 * Ownership detection, access control, exclusive quest previews, and
 * server-persisted Genesis XP bonus (+20%) when canReceiveGenesisXPBonus.
 */

export {
  GENESIS_FEATURES,
  GENESIS_HOLDER_TOKEN_ID,
  getGenesisFeature,
  isGenesisFeatureActive,
  isHoldingGenesis,
  resolveGenesisPerks,
} from "@/lib/genesis/features";
export type {
  GenesisFeatureDefinition,
  GenesisFeatureId,
  GenesisFeatureStatus,
  GenesisHolderState,
  GenesisPerkResolution,
} from "@/lib/genesis/types";
export {
  GENESIS_EXCLUSIVE_LABEL,
  GENESIS_QUEST_CATALOG,
  getGenesisQuestDefinition,
  listGenesisQuestIds,
  provideGenesisQuests,
  resolveGenesisExclusiveQuestIds,
} from "@/lib/genesis/quests";
export type {
  GenesisQuestDefinition,
  GenesisQuestId,
  GenesisQuestLifecycle,
  GenesisQuestViewModel,
  ProvideGenesisQuestsInput,
} from "@/lib/genesis/quests";
export {
  resolveGenesisAccess,
} from "@/lib/genesis/access";
export type {
  GenesisAccessPermissions,
  GenesisAccessState,
} from "@/lib/genesis/access";
export {
  calculateGenesisXP,
  awardGenesisAdjustedXp,
  GENESIS_XP_BONUS_RATE,
  parseRewardXpLabel,
} from "@/lib/genesis/xp";
export type {
  GenesisXPAccessInput,
  GenesisXPBreakdown,
} from "@/lib/genesis/xp";
