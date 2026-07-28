"use client";

import { CountUp } from "@/components/leaderboard/CountUp";
import { WalletAvatar } from "@/components/leaderboard/WalletAvatar";
import {
  formatXpGap,
  getXpGapToNeighbor,
  normalizeWalletAddress,
} from "@/components/leaderboard/utils";
import GlassPanel from "@/components/GlassPanel";
import type { LeaderboardEntry } from "@/lib/supabase/leaderboard";
import { formatWalletAddress, ui } from "@/lib/ui-styles";
import { motion, useReducedMotion } from "framer-motion";
import { Flame } from "lucide-react";

type LeaderboardTableProps = {
  entries: LeaderboardEntry[];
  normalizedWalletAddress: string | null;
};

function rowClass(isCurrentUser: boolean) {
  if (isCurrentUser) {
    return "border-base-blue bg-white/[0.04] shadow-[0_0_0_1px_rgba(0,82,255,0.35)]";
  }
  return "border-white/10 bg-white/[0.03] hover:border-white/16 hover:bg-white/[0.055]";
}

export default function LeaderboardTable({
  entries,
  normalizedWalletAddress,
}: LeaderboardTableProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
    >
      <GlassPanel className="p-1.5 sm:p-2" as="section">
        <div className="sr-only" id="leaderboard-table-label">
          Full leaderboard rankings
        </div>

        <div
          className="mb-1.5 hidden grid-cols-[2.75rem_minmax(0,1fr)_5.5rem_3.75rem] gap-2 px-2.5 py-1.5 text-[0.6rem] font-semibold uppercase tracking-widest text-white/40 sm:grid"
          aria-hidden
        >
          <span>Rank</span>
          <span>Player</span>
          <span className="text-right">XP</span>
          <span className="text-right">Streak</span>
        </div>

        <ol
          className="m-0 list-none space-y-1.5 p-0"
          aria-labelledby="leaderboard-table-label"
        >
          {entries.map((entry, index) => {
            const rank = index + 1;
            const isCurrentUser =
              normalizedWalletAddress !== null &&
              normalizeWalletAddress(entry.wallet_address) ===
                normalizedWalletAddress;
            const gap = getXpGapToNeighbor(entries, index);
            const gapLabel = formatXpGap(gap);

            return (
              <motion.li
                key={entry.wallet_address}
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.3,
                  delay: reduceMotion ? 0 : Math.min(index * 0.02, 0.35),
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <div
                  className={`rounded-2xl border px-2 py-2.5 transition-colors duration-200 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-base-blue/50 sm:px-2.5 sm:py-2.5 ${rowClass(isCurrentUser)}`}
                  tabIndex={0}
                  aria-label={`Rank ${rank}, ${formatWalletAddress(entry.wallet_address)}, ${entry.total_xp} XP, ${entry.streak} day streak. ${gapLabel}${isCurrentUser ? ". This is you." : ""}`}
                >
                  {/* Mobile */}
                  <div className="flex items-center gap-2 sm:hidden">
                    <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/[0.05] text-[0.7rem] font-bold tabular-nums text-white/80">
                      {rank}
                    </span>
                    <WalletAvatar address={entry.wallet_address} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <p
                          className="truncate font-mono text-xs tracking-wide text-white"
                          title={entry.wallet_address}
                        >
                          {formatWalletAddress(entry.wallet_address)}
                        </p>
                        {isCurrentUser ? (
                          <span className={ui.badgeYou}>You</span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 truncate text-[0.6rem] text-white/40">
                        {gapLabel}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <CountUp
                        value={entry.total_xp}
                        className="block font-sans text-xs font-semibold tabular-nums text-white"
                      />
                      <span className="mt-0.5 inline-flex items-center justify-end gap-0.5 text-[0.65rem] font-semibold tabular-nums text-white/55">
                        <Flame className="size-3 text-orange-300" aria-hidden />
                        {entry.streak}
                      </span>
                    </div>
                  </div>

                  {/* Desktop */}
                  <div className="hidden grid-cols-[2.75rem_minmax(0,1fr)_5.5rem_3.75rem] items-center gap-2 sm:grid">
                    <span className="inline-flex size-8 items-center justify-center rounded-full border border-white/12 bg-white/[0.05] text-xs font-bold tabular-nums text-white/80">
                      {rank}
                    </span>

                    <div className="flex min-w-0 items-center gap-2.5">
                      <WalletAvatar address={entry.wallet_address} size="sm" />
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                          <p
                            className="truncate font-mono text-sm tracking-wide text-white"
                            title={entry.wallet_address}
                          >
                            {formatWalletAddress(entry.wallet_address)}
                          </p>
                          {isCurrentUser ? (
                            <span className={ui.badgeYou}>You</span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 truncate text-[0.7rem] text-white/40">
                          {gapLabel}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <CountUp
                        value={entry.total_xp}
                        className="font-sans text-sm font-semibold tabular-nums text-white"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-1 text-right font-sans text-sm font-semibold tabular-nums text-white/65">
                      <Flame className="size-3.5 text-orange-300" aria-hidden />
                      <span>{entry.streak}</span>
                    </div>
                  </div>
                </div>
              </motion.li>
            );
          })}
        </ol>
      </GlassPanel>
    </motion.div>
  );
}
