import type { GenesisAccessPermissions } from "@/lib/genesis/access/types";

/**
 * Resolve Genesis feature permissions from ownership.
 *
 * Phase 1: every permission mirrors `isGenesisHolder`.
 *
 * Future permissions can become independent. Example stacked gates:
 *   Genesis Holder
 *   + Minimum XP
 *   + Quest Completion
 *   + Whitelist
 *
 * When that lands, update only this resolver (and optional inputs) —
 * UI and feature hooks should keep calling `useGenesisAccess()`.
 */
export function resolveGenesisAccess(
  isGenesisHolder: boolean,
): GenesisAccessPermissions {
  // Today: all feature gates equal holder status.
  // Tomorrow: evaluate each permission independently (XP, quests, whitelist, etc.).
  return {
    isGenesisHolder,
    canAccessGenesisQuests: isGenesisHolder,
    canReceiveGenesisXPBonus: isGenesisHolder,
    canAccessGenesisAirdrops: isGenesisHolder,
    canAccessGenesisBeta: isGenesisHolder,
  };
}
