/**
 * Genesis holder system — shared types for Phase 1 foundation.
 * Feature effects (XP, quests, airdrops) stay planned until later phases.
 */

export type GenesisFeatureId =
  | "xp-bonus"
  | "exclusive-quests"
  | "airdrops";

export type GenesisFeatureStatus = "planned" | "active" | "disabled";

export type GenesisFeatureDefinition = {
  id: GenesisFeatureId;
  title: string;
  description: string;
  status: GenesisFeatureStatus;
};

export type GenesisHolderState = {
  isGenesisHolder: boolean;
  balance: bigint;
  loading: boolean;
};

/**
 * Resolved holder perks — placeholders only.
 * Do not wire into quest/XP engines until a later phase.
 */
export type GenesisPerkResolution = {
  isGenesisHolder: boolean;
  /** Future: XP multiplier when active (e.g. 1.1). null = not applied. */
  xpBonusMultiplier: number | null;
  /** Future: exclusive quest ids unlocked for holders. */
  exclusiveQuestIds: readonly string[];
  /** Future: airdrop eligibility flag. */
  airdropEligible: boolean;
};
