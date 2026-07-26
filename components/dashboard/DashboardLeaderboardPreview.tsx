"use client";

import GlassPanel from "@/components/GlassPanel";
import AnimatedCounter from "@/components/ui/AnimatedCounter";
import {
  getLeaderboard,
  type LeaderboardEntry,
} from "@/lib/supabase/leaderboard";
import { formatWalletAddress, ui } from "@/lib/ui-styles";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

/**
 * Read-only leaderboard preview for the Dashboard (existing getLeaderboard).
 */
export default function DashboardLeaderboardPreview() {
  const { address } = useAccount();
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const data = await getLeaderboard();
      if (cancelled) {
        return;
      }
      setEntries(data?.slice(0, 5) ?? []);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const normalized = address?.toLowerCase() ?? null;

  return (
    <GlassPanel className={`h-full ${ui.dashCardPad}`}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className={ui.statLabel}>Rankings</p>
          <h3 className="mt-1 font-sans text-lg font-semibold text-white sm:text-xl">
            Top builders
          </h3>
        </div>
        <Link
          href="/leaderboard"
          className="text-xs font-semibold text-cyan-200/90 underline-offset-2 hover:underline sm:text-sm"
        >
          Full board
        </Link>
      </div>

      <div className="mt-4 flex flex-1 flex-col space-y-2 sm:mt-5">
        {loading ? (
          Array.from({ length: 5 }, (_, index) => (
            <div
              key={index}
              className="h-12 animate-pulse rounded-xl border border-white/8 bg-white/[0.03]"
            />
          ))
        ) : !entries || entries.length === 0 ? (
          <p className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-4 text-center text-sm text-white/45">
            Leaderboard is warming up. Complete quests to appear.
          </p>
        ) : (
          entries.map((entry, index) => {
            const isYou =
              normalized !== null &&
              entry.wallet_address.toLowerCase() === normalized;
            return (
              <div
                key={entry.wallet_address}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 sm:gap-4 sm:px-3.5 ${
                  isYou
                    ? "border-cyan-300/25 bg-cyan-500/10"
                    : "border-white/[0.08] bg-white/[0.03]"
                }`}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] font-mono text-xs font-bold text-white/80">
                  #{index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate font-mono text-xs text-white sm:text-sm"
                    title={entry.wallet_address}
                  >
                    {formatWalletAddress(entry.wallet_address)}
                  </p>
                  <p className="mt-0.5 text-[0.65rem] text-white/40">
                    {entry.streak}d streak
                    {isYou ? " · You" : ""}
                  </p>
                </div>
                <AnimatedCounter
                  value={entry.total_xp}
                  className="shrink-0 font-mono text-sm font-semibold tabular-nums text-cyan-100"
                  format={(n) => `${n.toLocaleString()} XP`}
                />
              </div>
            );
          })
        )}
      </div>
    </GlassPanel>
  );
}
