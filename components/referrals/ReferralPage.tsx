"use client";

import GlassPanel from "@/components/GlassPanel";
import PageShell from "@/components/PageShell";
import AnimatedCounter from "@/components/ui/AnimatedCounter";
import {
  fetchReferralDashboard,
  fetchReferralLeaderboard,
} from "@/lib/referrals/client";
import { REFERRAL_REWARD_XP } from "@/lib/referrals/constants";
import { formatWalletAddress, ui } from "@/lib/ui-styles";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useAccount } from "wagmi";

function ReferralSkeleton() {
  return (
    <div className="flex flex-col gap-8 sm:gap-10">
      <div className={`${ui.glassCard} animate-pulse ${ui.dashCardPad}`}>
        <div className="h-4 w-28 rounded bg-white/10" />
        <div className="mt-3 h-8 w-56 rounded bg-white/10" />
        <div className="mt-5 h-12 w-full rounded-xl bg-white/10" />
      </div>
      <div className={ui.gridStats}>
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className={`${ui.glassCard} min-h-[9rem] animate-pulse ${ui.dashCardPad}`}
          />
        ))}
      </div>
    </div>
  );
}

export default function ReferralPage() {
  const { address, status: walletStatus } = useAccount();
  const isConnected = walletStatus === "connected" && Boolean(address);
  const [copied, setCopied] = useState(false);

  const dashboardQuery = useQuery({
    queryKey: ["referral-dashboard", address?.toLowerCase()],
    queryFn: async () => {
      const data = await fetchReferralDashboard(address as string);
      if (!data) {
        throw new Error("Unable to load referral dashboard");
      }
      return data;
    },
    enabled: Boolean(isConnected && address),
    staleTime: 30_000,
    retry: 1,
  });

  const leaderboardQuery = useQuery({
    queryKey: ["referral-leaderboard"],
    queryFn: fetchReferralLeaderboard,
    staleTime: 60_000,
    retry: 1,
  });

  const dashboard = dashboardQuery.data;
  const leaderboardEntries = leaderboardQuery.data ?? [];

  const shareText = useMemo(() => {
    if (!dashboard) {
      return "Join me on BaseQuest Rewards — earn XP on Base.";
    }
    return `Join me on BaseQuest Rewards and earn XP on Base. Use my invite: ${dashboard.link}`;
  }, [dashboard]);

  const xShareHref = useMemo(() => {
    const url = dashboard?.link ?? "";
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}${
      url ? `&url=${encodeURIComponent(url)}` : ""
    }`;
  }, [dashboard, shareText]);

  const farcasterShareHref = useMemo(() => {
    return `https://warpcast.com/~/compose?text=${encodeURIComponent(shareText)}`;
  }, [shareText]);

  async function handleCopyLink() {
    if (!dashboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(dashboard.link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const normalizedAddress = address?.toLowerCase() ?? null;

  return (
    <PageShell>
      <section className={`${ui.dashSection} text-center sm:text-left`}>
        <p className={ui.sectionHeading}>Invite</p>
        <h1 className={ui.pageTitle}>Referrals</h1>
        <p className={ui.pageSubtitle}>
          Share your link. Earn {REFERRAL_REWARD_XP} XP when friends connect a
          wallet and complete their first daily check-in.
        </p>
      </section>

      {!isConnected ? (
        <GlassPanel className={`${ui.dashCardPad} text-center sm:p-8`}>
          <p className={ui.messageTitle}>Connect your wallet</p>
          <p className="mt-2 text-sm text-white/45">
            Connect to generate your personal referral link and track invites.
          </p>
        </GlassPanel>
      ) : null}

      {isConnected && dashboardQuery.isLoading ? <ReferralSkeleton /> : null}

      {isConnected && dashboardQuery.isError ? (
        <GlassPanel className={`${ui.dashCardPad} text-center sm:p-8`}>
          <p className={ui.messageTitle}>Unable to load referrals</p>
          <p className="mt-2 text-sm text-white/45">
            Please try again in a moment.
          </p>
          <button
            type="button"
            className={`${ui.secondaryButton} mt-4`}
            onClick={() => void dashboardQuery.refetch()}
          >
            Retry
          </button>
        </GlassPanel>
      ) : null}

      {isConnected && dashboard ? (
        <>
          <section className={ui.dashSection}>
            <GlassPanel className={ui.dashCardPad}>
              <p className={ui.statLabel}>Your invite</p>
              <p className="mt-1 font-sans text-lg font-semibold text-white sm:text-xl">
                Personal referral link
              </p>
              <p className="mt-1 text-sm text-white/45">
                Code{" "}
                <span className="font-mono font-semibold text-cyan-100">
                  {dashboard.code}
                </span>
              </p>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1 truncate rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 font-mono text-xs text-white/80 sm:text-sm">
                  {dashboard.link}
                </div>
                <button
                  type="button"
                  onClick={() => void handleCopyLink()}
                  className={`${copied ? ui.primaryButton : ui.secondaryButton} w-full shrink-0 sm:w-auto`}
                >
                  {copied ? "Copied!" : "Copy link"}
                </button>
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <a
                  href={xShareHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${ui.primaryButton} w-full text-center sm:flex-1`}
                >
                  Share on X
                </a>
                <a
                  href={farcasterShareHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${ui.secondaryButton} w-full text-center sm:flex-1`}
                >
                  Share on Farcaster
                </a>
              </div>
            </GlassPanel>
          </section>

          <section className={ui.dashSection}>
            <div className={ui.sectionHeaderWrap}>
              <p className={ui.sectionHeading}>Stats</p>
              <h2 className={ui.sectionTitle}>Referral Statistics</h2>
            </div>
            <div className={ui.gridStats}>
              <article className={ui.statCard}>
                <p className={ui.statLabel}>Total Referrals</p>
                <p className={ui.statValue}>
                  <AnimatedCounter value={dashboard.stats.totalReferrals} />
                </p>
              </article>
              <article className={ui.statCard}>
                <p className={ui.statLabel}>Successful</p>
                <p className={`${ui.statValue} text-emerald-200`}>
                  <AnimatedCounter
                    value={dashboard.stats.successfulReferrals}
                  />
                </p>
              </article>
              <article className={ui.statCard}>
                <p className={ui.statLabel}>Pending</p>
                <p className={`${ui.statValue} text-cyan-100`}>
                  <AnimatedCounter value={dashboard.stats.pendingReferrals} />
                </p>
              </article>
              <article className={ui.statCard}>
                <p className={ui.statLabel}>Referral XP</p>
                <p className={ui.statValue}>
                  <AnimatedCounter value={dashboard.stats.totalReferralXp} />
                </p>
              </article>
            </div>
          </section>
        </>
      ) : null}

      <section className={ui.dashSection}>
        <div className={ui.sectionHeaderWrap}>
          <p className={ui.sectionHeading}>Community</p>
          <h2 className={ui.sectionTitle}>Top Referrers</h2>
          <p className={ui.sectionDescription}>
            Ranked by successful referrals after friends finish onboarding.
          </p>
        </div>

        {leaderboardQuery.isLoading ? (
          <div className={`${ui.glassCard} animate-pulse ${ui.dashCardPad}`}>
            <div className="space-y-2">
              {Array.from({ length: 5 }, (_, index) => (
                <div key={index} className="h-12 rounded-xl bg-white/10" />
              ))}
            </div>
          </div>
        ) : null}

        {leaderboardQuery.isError ? (
          <GlassPanel className={`${ui.dashCardPad} text-center`}>
            <p className="text-sm text-white/45">
              Unable to load the referrer leaderboard.
            </p>
          </GlassPanel>
        ) : null}

        {leaderboardQuery.isSuccess && leaderboardEntries.length === 0 ? (
          <GlassPanel className={`${ui.dashCardPad} text-center`}>
            <p className="text-sm text-white/45">
              No successful referrals yet. Be the first to invite a builder.
            </p>
          </GlassPanel>
        ) : null}

        {leaderboardQuery.isSuccess && leaderboardEntries.length > 0 ? (
          <GlassPanel className={ui.dashCardPad}>
            <ul className="space-y-2">
              {leaderboardEntries.map((entry, index) => {
                const isYou =
                  normalizedAddress !== null &&
                  entry.wallet_address.toLowerCase() === normalizedAddress;
                return (
                  <li
                    key={entry.wallet_address}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 sm:gap-4 ${
                      isYou
                        ? "border-cyan-300/25 bg-cyan-500/10"
                        : "border-white/[0.08] bg-white/[0.03]"
                    }`}
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] font-mono text-xs font-bold text-white/80">
                      #{index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-xs text-white sm:text-sm">
                        {formatWalletAddress(entry.wallet_address)}
                        {isYou ? (
                          <span className={`ml-2 ${ui.badgeYou}`}>You</span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-[0.65rem] text-white/40">
                        {entry.total_referral_xp.toLocaleString()} XP earned
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-cyan-100">
                      {entry.successful_referrals}
                    </span>
                  </li>
                );
              })}
            </ul>
          </GlassPanel>
        ) : null}
      </section>
    </PageShell>
  );
}
