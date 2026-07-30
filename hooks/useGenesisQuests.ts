"use client";

import { useGenesisAccess } from "@/hooks/useGenesisAccess";
import {
  provideGenesisQuests,
  type GenesisQuestViewModel,
} from "@/lib/genesis/quests";
import { useMemo } from "react";
import type { Address } from "viem";

export type GenesisQuestsState = {
  isGenesisHolder: boolean;
  canAccessGenesisQuests: boolean;
  loading: boolean;
  quests: GenesisQuestViewModel[];
};

/**
 * Access-gated Genesis quests via centralized `useGenesisAccess()`.
 * Empty when `canAccessGenesisQuests` is false / while loading.
 */
export function useGenesisQuests(address?: Address): GenesisQuestsState {
  const { isGenesisHolder, canAccessGenesisQuests, loading } =
    useGenesisAccess(address);

  const quests = useMemo(
    () => provideGenesisQuests({ canAccessGenesisQuests }),
    [canAccessGenesisQuests],
  );

  return {
    isGenesisHolder,
    canAccessGenesisQuests,
    loading,
    quests,
  };
}
