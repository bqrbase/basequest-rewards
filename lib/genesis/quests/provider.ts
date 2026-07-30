import {
  GENESIS_QUEST_CATALOG,
  listGenesisQuestIds,
} from "@/lib/genesis/quests/catalog";
import type {
  GenesisQuestDefinition,
  GenesisQuestViewModel,
} from "@/lib/genesis/quests/types";

export type ProvideGenesisQuestsInput = {
  /**
   * From `useGenesisAccess().canAccessGenesisQuests`.
   * Phase 1 mirrors holder status; future gates may differ.
   */
  canAccessGenesisQuests: boolean;
};

function toViewModel(quest: GenesisQuestDefinition): GenesisQuestViewModel {
  return {
    ...quest,
    rewardLabel: `${quest.rewardXp} XP`,
    // Phase 1: visible placeholders only — never claimable.
    claimable: false,
  };
}

/**
 * Genesis quest provider.
 * Returns exclusive quests only when access control allows.
 * Denied access receives an empty list (existing quest UX unchanged).
 */
export function provideGenesisQuests(
  input: ProvideGenesisQuestsInput,
): GenesisQuestViewModel[] {
  if (!input.canAccessGenesisQuests) {
    return [];
  }

  return GENESIS_QUEST_CATALOG.map(toViewModel);
}

/** Quest ids exposed when quest access is granted (for future perk resolution). */
export function resolveGenesisExclusiveQuestIds(
  canAccessGenesisQuests: boolean,
): readonly string[] {
  if (!canAccessGenesisQuests) {
    return [];
  }
  return listGenesisQuestIds();
}
