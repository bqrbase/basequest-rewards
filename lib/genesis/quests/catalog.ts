import {
  GENESIS_EXCLUSIVE_LABEL,
  type GenesisQuestDefinition,
  type GenesisQuestId,
} from "@/lib/genesis/quests/types";

/**
 * Genesis exclusive quest catalog.
 * Add future holder quests here — provider stays the single access point.
 */
export const GENESIS_QUEST_CATALOG: readonly GenesisQuestDefinition[] = [
  {
    id: "genesis-weekly",
    title: "Genesis Weekly Quest",
    description:
      "A weekly challenge reserved for Genesis holders. Coming soon.",
    rewardXp: 100,
    exclusiveLabel: GENESIS_EXCLUSIVE_LABEL,
    lifecycle: "disabled",
    ctaLabel: "Coming Soon",
  },
  {
    id: "genesis-community",
    title: "Genesis Community Quest",
    description:
      "A community challenge reserved for Genesis holders. Coming soon.",
    rewardXp: 50,
    exclusiveLabel: GENESIS_EXCLUSIVE_LABEL,
    lifecycle: "disabled",
    ctaLabel: "Coming Soon",
  },
] as const;

export function getGenesisQuestDefinition(
  id: GenesisQuestId,
): GenesisQuestDefinition | undefined {
  return GENESIS_QUEST_CATALOG.find((quest) => quest.id === id);
}

export function listGenesisQuestIds(): readonly GenesisQuestId[] {
  return GENESIS_QUEST_CATALOG.map((quest) => quest.id);
}
