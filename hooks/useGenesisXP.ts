"use client";

import { useGenesisAccess } from "@/hooks/useGenesisAccess";
import {
  calculateGenesisXP,
  type GenesisXPBreakdown,
} from "@/lib/genesis/xp";
import { useMemo } from "react";
import type { Address } from "viem";

/**
 * Display-only Genesis XP breakdown for a base reward.
 * Does not mutate stored XP.
 */
export function useGenesisXP(
  baseXP: number,
  address?: Address,
): GenesisXPBreakdown & {
  canReceiveGenesisXPBonus: boolean;
  loading: boolean;
} {
  const { canReceiveGenesisXPBonus, loading } = useGenesisAccess(address);

  const breakdown = useMemo(
    () => calculateGenesisXP(baseXP, { canReceiveGenesisXPBonus }),
    [baseXP, canReceiveGenesisXPBonus],
  );

  return {
    ...breakdown,
    canReceiveGenesisXPBonus,
    loading,
  };
}
