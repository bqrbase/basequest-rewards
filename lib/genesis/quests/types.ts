/**
 * Genesis exclusive quest types — separate from the core quest engine.
 */

export const GENESIS_EXCLUSIVE_LABEL = "Exclusive for Genesis Holders" as const;

export type GenesisQuestId =
  | "genesis-weekly"
  | "genesis-community";

/**
 * Genesis quest lifecycle.
 * Phase 1 keeps all catalog entries as "disabled" (visible, not claimable).
 */
export type GenesisQuestLifecycle = "disabled" | "available" | "completed";

export type GenesisQuestDefinition = {
  id: GenesisQuestId;
  title: string;
  description: string;
  rewardXp: number;
  exclusiveLabel: typeof GENESIS_EXCLUSIVE_LABEL;
  /** Catalog default lifecycle — claim flow is not wired yet. */
  lifecycle: GenesisQuestLifecycle;
  ctaLabel: string;
};

export type GenesisQuestViewModel = GenesisQuestDefinition & {
  rewardLabel: string;
  /** Always false in Phase 1 — no claiming. */
  claimable: boolean;
};
