/**
 * Centralized Genesis access control types.
 *
 * Future permissions can become independent of simple holder status.
 * Example stacked gates:
 *   Genesis Holder
 *   + Minimum XP
 *   + Quest Completion
 *   + Whitelist
 */

export type GenesisAccessState = {
  isGenesisHolder: boolean;
  canAccessGenesisQuests: boolean;
  canReceiveGenesisXPBonus: boolean;
  canAccessGenesisAirdrops: boolean;
  canAccessGenesisBeta: boolean;
  loading: boolean;
};

export type GenesisAccessPermissions = Omit<GenesisAccessState, "loading">;
