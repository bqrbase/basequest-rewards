"use client";

import { useGenesisAccess } from "@/hooks/useGenesisAccess";
import type { Address } from "viem";

type GenesisBonusActiveBadgeProps = {
  address?: Address;
  className?: string;
};

/**
 * Small indicator when Genesis XP bonus is active for the wallet.
 * Display only — does not change stored XP.
 */
export default function GenesisBonusActiveBadge({
  address,
  className = "",
}: GenesisBonusActiveBadgeProps) {
  const { canReceiveGenesisXPBonus, loading } = useGenesisAccess(address);

  if (loading || !canReceiveGenesisXPBonus) {
    return null;
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-badge border border-amber-300/35 bg-amber-500/15 px-2 py-0.5 text-[0.5rem] font-bold uppercase tracking-[0.12em] text-amber-100 shadow-[0_0_12px_rgba(251,191,36,0.22)] sm:text-[0.55rem] ${className}`.trim()}
      title="Genesis holders earn 20% more XP (display preview)"
    >
      <span
        aria-hidden
        className="size-1.5 rounded-full bg-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.85)]"
      />
      Genesis Bonus Active
    </span>
  );
}
