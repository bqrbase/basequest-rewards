"use client";

import { useGenesisHolder } from "@/hooks/useGenesisHolder";
import {
  resolveGenesisAccess,
  type GenesisAccessState,
} from "@/lib/genesis/access";
import { useMemo } from "react";
import type { Address } from "viem";

/**
 * Centralized Genesis access control.
 *
 * Phase 1: every `canAccess*` flag equals `isGenesisHolder`.
 *
 * Future permissions can become independent. Example stacked gates:
 *   Genesis Holder
 *   + Minimum XP
 *   + Quest Completion
 *   + Whitelist
 *
 * Prefer this hook over calling `useGenesisHolder()` for feature gates.
 */
export function useGenesisAccess(address?: Address): GenesisAccessState {
  const { isGenesisHolder, loading } = useGenesisHolder(address);

  const permissions = useMemo(
    () => resolveGenesisAccess(isGenesisHolder),
    [isGenesisHolder],
  );

  return {
    ...permissions,
    loading,
  };
}
