import type {
  GenesisFeatureDefinition,
  GenesisFeatureId,
  GenesisPerkResolution,
} from "@/lib/genesis/types";
import { BASEQUEST_GENESIS_HOLDER_TOKEN_ID } from "@/lib/contracts/abi/BaseQuestGenesis";
import { resolveGenesisAccess } from "@/lib/genesis/access/permissions";
import { resolveGenesisExclusiveQuestIds } from "@/lib/genesis/quests/provider";
import { GENESIS_XP_BONUS_RATE } from "@/lib/genesis/xp";

export { BASEQUEST_GENESIS_HOLDER_TOKEN_ID as GENESIS_HOLDER_TOKEN_ID };

/**
 * Planned Genesis holder features.
 * Exclusive quests are visible to holders as disabled placeholders;
 * claim/XP effects remain planned until a later phase.
 */
export const GENESIS_FEATURES: readonly GenesisFeatureDefinition[] = [
  {
    id: "xp-bonus",
    title: "XP Bonus",
    description:
      "Genesis holders earn 20% more XP on awarded quests (server-persisted).",
    status: "active",
  },
  {
    id: "exclusive-quests",
    title: "Exclusive Quests",
    description:
      "Holder-only quests and campaigns reserved for Genesis NFT owners.",
    status: "planned",
  },
  {
    id: "airdrops",
    title: "Future Airdrops",
    description:
      "Eligibility surface for future BaseQuest airdrop and reward programs.",
    status: "planned",
  },
] as const;

export function getGenesisFeature(
  id: GenesisFeatureId,
): GenesisFeatureDefinition | undefined {
  return GENESIS_FEATURES.find((feature) => feature.id === id);
}

/** Phase 1: no features apply runtime XP/quest effects yet. */
export function isGenesisFeatureActive(id: GenesisFeatureId): boolean {
  return getGenesisFeature(id)?.status === "active";
}

export function isHoldingGenesis(balance: bigint): boolean {
  return balance > 0n;
}

/**
 * Resolve holder perks from ownership state.
 * Exclusive quest ids follow quest access (today: same as holder).
 * XP/airdrop effects stay inert until those permissions are activated.
 */
export function resolveGenesisPerks(
  isGenesisHolder: boolean,
): GenesisPerkResolution {
  const { canAccessGenesisQuests, canReceiveGenesisXPBonus } =
    resolveGenesisAccess(isGenesisHolder);

  return {
    isGenesisHolder,
    // Display/architecture only — core XP storage is unchanged.
    xpBonusMultiplier: canReceiveGenesisXPBonus ? 1 + GENESIS_XP_BONUS_RATE : null,
    exclusiveQuestIds: resolveGenesisExclusiveQuestIds(canAccessGenesisQuests),
    airdropEligible: false,
  };
}
