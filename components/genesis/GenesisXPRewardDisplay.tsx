"use client";

import GenesisBonusActiveBadge from "@/components/genesis/GenesisBonusActiveBadge";
import { useGenesisXP } from "@/hooks/useGenesisXP";
import {
  parseRewardXpLabel,
} from "@/lib/genesis/xp";

type GenesisXPRewardDisplayProps = {
  /** Numeric base XP when known. */
  baseXP?: number;
  /** Fallback label (e.g. "+50 XP") used when baseXP is omitted. */
  rewardLabel?: string;
  className?: string;
  /** Compact pill for card headers vs stacked breakdown. */
  variant?: "stacked" | "compact";
};

/**
 * Displays Base Reward / Genesis Bonus / Total Reward when bonus applies.
 * Falls back to the plain reward label for non-holders.
 * Calculation only — does not award XP.
 */
export default function GenesisXPRewardDisplay({
  baseXP,
  rewardLabel,
  className = "",
  variant = "stacked",
}: GenesisXPRewardDisplayProps) {
  const parsed =
    baseXP !== undefined ? baseXP : rewardLabel ? parseRewardXpLabel(rewardLabel) : null;
  const resolvedBase = parsed ?? 0;
  const { baseXP: base, bonusXP, totalXP, canReceiveGenesisXPBonus, loading } =
    useGenesisXP(resolvedBase);

  const fallback = rewardLabel ?? (resolvedBase > 0 ? `+${resolvedBase} XP` : "—");

  if (parsed === null || loading || !canReceiveGenesisXPBonus || bonusXP === 0) {
    return (
      <span
        className={`shrink-0 rounded-full border border-base-blue/35 bg-gradient-to-r from-base-blue/85 to-indigo-600/85 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-white shadow-[0_0_16px_rgba(0,82,255,0.22)] sm:px-3 sm:text-xs ${className}`.trim()}
      >
        {fallback}
      </span>
    );
  }

  if (variant === "compact") {
    return (
      <div
        className={`flex shrink-0 flex-col items-end gap-1 ${className}`.trim()}
      >
        <GenesisBonusActiveBadge />
        <span className="rounded-full border border-base-blue/35 bg-gradient-to-r from-base-blue/85 to-indigo-600/85 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-white shadow-[0_0_16px_rgba(0,82,255,0.22)] sm:px-3 sm:text-xs">
          +{totalXP} XP
        </span>
        <div className="text-right text-[0.55rem] leading-relaxed text-white/50">
          <p>Base Reward: {base} XP</p>
          <p>Genesis Bonus: +{bonusXP} XP</p>
          <p className="font-semibold text-cyan-100/80">
            Total Reward: {totalXP} XP
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-cyan-300/20 bg-cyan-500/[0.07] px-3 py-2.5 ${className}`.trim()}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <GenesisBonusActiveBadge />
      </div>
      <dl className="space-y-1 text-xs text-white/65 sm:text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt>Base Reward</dt>
          <dd className="font-semibold tabular-nums text-white/85">{base} XP</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt>Genesis Bonus</dt>
          <dd className="font-semibold tabular-nums text-amber-100">
            +{bonusXP} XP
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-1.5">
          <dt className="font-semibold text-white">Total Reward</dt>
          <dd className="font-bold tabular-nums text-cyan-100">{totalXP} XP</dd>
        </div>
      </dl>
    </div>
  );
}
