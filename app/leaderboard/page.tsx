"use client";

import GlassPanel from "@/components/GlassPanel";
import LeaderboardStats from "@/components/leaderboard/LeaderboardStats";
import LeaderboardTable from "@/components/leaderboard/LeaderboardTable";
import Podium from "@/components/leaderboard/Podium";
import {
  computeLeaderboardStats,
  normalizeWalletAddress,
} from "@/components/leaderboard/utils";
import PageShell from "@/components/PageShell";
import { useQuestEngine } from "@/hooks/useQuestEngine";
import {
  getLeaderboard,
  type LeaderboardEntry,
} from "@/lib/supabase/leaderboard";
import { ui } from "@/lib/ui-styles";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAccount } from "wagmi";

type LeaderboardState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "empty" }
  | { status: "ready"; entries: LeaderboardEntry[] };

function LeaderboardSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <div className="grid grid-cols-3 items-end gap-2 sm:gap-4">
        <div className={`${ui.glassCard} h-40 animate-pulse sm:h-48`} />
        <div className={`${ui.glassCard} h-52 animate-pulse sm:h-60`} />
        <div className={`${ui.glassCard} h-36 animate-pulse sm:h-44`} />
      </div>
      <div className="space-y-1.5">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className={`${ui.glassCard} h-12 animate-pulse sm:h-14`}
          />
        ))}
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  const { address } = useAccount();
  const { hydrated, progressReady, quests, handleQuestAction } = useQuestEngine();
  const hasCompletedViewLeaderboard = useRef(false);
  const [leaderboardState, setLeaderboardState] = useState<LeaderboardState>({
    status: "loading",
  });

  useEffect(() => {
    let cancelled = false;

    async function loadLeaderboard() {
      setLeaderboardState({ status: "loading" });

      const entries = await getLeaderboard();
      if (cancelled) {
        return;
      }

      if (entries === null) {
        setLeaderboardState({ status: "error" });
        return;
      }

      if (entries.length === 0) {
        setLeaderboardState({ status: "empty" });
        return;
      }

      setLeaderboardState({ status: "ready", entries });
    }

    void loadLeaderboard();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated || !progressReady || hasCompletedViewLeaderboard.current) {
      return;
    }

    const viewLeaderboardQuest = quests.find(
      (quest) => quest.id === "view-leaderboard",
    );

    if (!viewLeaderboardQuest || viewLeaderboardQuest.status !== "available") {
      return;
    }

    hasCompletedViewLeaderboard.current = true;
    handleQuestAction("view-leaderboard");
  }, [hydrated, progressReady, quests, handleQuestAction]);

  const normalizedWalletAddress = useMemo(
    () => normalizeWalletAddress(address),
    [address],
  );

  const stats =
    leaderboardState.status === "ready"
      ? computeLeaderboardStats(leaderboardState.entries)
      : null;

  return (
    <PageShell>
      <section className="-mt-1 space-y-4 sm:-mt-2 sm:space-y-5">
        {leaderboardState.status === "loading" ? <LeaderboardSkeleton /> : null}

        {leaderboardState.status === "error" ? (
          <GlassPanel className="p-6 text-center sm:p-8">
            <p className={ui.messageTitle}>Leaderboard unavailable</p>
            <p className="mt-2 text-sm text-white/45">
              Please try again in a moment.
            </p>
          </GlassPanel>
        ) : null}

        {leaderboardState.status === "empty" ? (
          <GlassPanel className="p-6 text-center sm:p-8">
            <p className={ui.messageTitle}>No players yet</p>
            <p className="mt-2 text-sm text-white/45">
              Complete quests on the dashboard to claim the top spot.
            </p>
          </GlassPanel>
        ) : null}

        {leaderboardState.status === "ready" && stats ? (
          <>
            <Podium
              entries={leaderboardState.entries}
              normalizedWalletAddress={normalizedWalletAddress}
            />

            <LeaderboardTable
              entries={leaderboardState.entries}
              normalizedWalletAddress={normalizedWalletAddress}
            />

            <LeaderboardStats
              totalPlayers={stats.totalPlayers}
              totalXp={stats.totalXp}
              highestStreak={stats.highestStreak}
              activePlayers={null}
            />
          </>
        ) : null}
      </section>
    </PageShell>
  );
}
