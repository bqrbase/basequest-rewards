"use client";

import ProfileActivity from "@/components/profile/ProfileActivity";
import ProfileBadges from "@/components/profile/ProfileBadges";
import ProfileHero from "@/components/profile/ProfileHero";
import ProfileProgress from "@/components/profile/ProfileProgress";
import ProfileShare from "@/components/profile/ProfileShare";
import ProfileSkeleton from "@/components/profile/ProfileSkeleton";
import ProfileStatistics from "@/components/profile/ProfileStatistics";
import GlassPanel from "@/components/GlassPanel";
import PageShell from "@/components/PageShell";
import {
  deriveAchievements,
  deriveBadges,
  summarizeAchievements,
} from "@/lib/achievements";
import { getLevel } from "@/lib/levels";
import { deriveProfileActivityMetrics } from "@/lib/profile/activityMetrics";
import { getCurrentUserRank } from "@/lib/supabase/leaderboard";
import { getUserProfile, type UserProfile } from "@/lib/supabase/profile";
import { ui } from "@/lib/ui-styles";
import { useQuestEngine } from "@/hooks/useQuestEngine";
import { useWalletScoreData } from "@/hooks/useWalletScoreData";
import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";

type ProfileState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; profile: UserProfile; rank: number | null };

function normalizeWalletAddress(walletAddress?: string | null) {
  return walletAddress?.toLowerCase() ?? null;
}

function formatMemberSince(createdAt: string) {
  return new Date(createdAt).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function ProfileHub() {
  const { address } = useAccount();
  const normalizedWalletAddress = useMemo(
    () => normalizeWalletAddress(address),
    [address],
  );
  const [profileState, setProfileState] = useState<ProfileState>({
    status: "loading",
  });

  const { hydrated, progress, quests } = useQuestEngine();
  const walletScore = useWalletScoreData();

  useEffect(() => {
    if (!normalizedWalletAddress) {
      return;
    }

    let cancelled = false;
    const walletAddress = normalizedWalletAddress;

    async function loadProfile() {
      setProfileState({ status: "loading" });

      const [profile, rankResult] = await Promise.all([
        getUserProfile(walletAddress),
        getCurrentUserRank(walletAddress),
      ]);

      if (cancelled) {
        return;
      }

      if (!profile) {
        setProfileState({ status: "error" });
        return;
      }

      setProfileState({
        status: "ready",
        profile,
        rank: rankResult?.rank ?? null,
      });
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [normalizedWalletAddress]);

  const achievements = useMemo(
    () => deriveAchievements(progress, quests),
    [progress, quests],
  );
  const badges = useMemo(() => deriveBadges(achievements), [achievements]);
  const achievementSummary = useMemo(
    () => summarizeAchievements(achievements, badges),
    [achievements, badges],
  );
  const achievementTitles = useMemo(
    () => new Map(achievements.map((item) => [item.id, item.title])),
    [achievements],
  );

  const completedQuestIds =
    profileState.status === "ready"
      ? profileState.profile.completed_quests
      : progress.completedQuestIds;

  const activityMetrics = useMemo(
    () => deriveProfileActivityMetrics(walletScore, completedQuestIds),
    [walletScore, completedQuestIds],
  );

  const showSkeleton =
    Boolean(normalizedWalletAddress) &&
    (profileState.status === "loading" || !hydrated);

  const totalXp =
    profileState.status === "ready"
      ? profileState.profile.total_xp
      : progress.totalXp;
  const streak =
    profileState.status === "ready"
      ? profileState.profile.streak
      : progress.streak;
  const level = getLevel(totalXp);

  const walletScoreValue =
    walletScore.live.isConnected && !walletScore.live.isLoading
      ? walletScore.hero.score
      : walletScore.live.isConnected && walletScore.analytics.fromCache
        ? walletScore.hero.score
        : null;

  const metricsLoading =
    walletScore.live.isConnected &&
    walletScore.live.isLoading &&
    !walletScore.analytics.fromCache;

  return (
    <PageShell>
      <section className={`${ui.dashSection} text-center sm:text-left`}>
        <p className={ui.sectionHeading}>Profile</p>
        <h1 className={ui.pageTitle}>Your Hub</h1>
        <p className={ui.pageSubtitle}>
          Wallet, achievements, quests, and Base Wallet Score — one place.
        </p>
      </section>

      {!normalizedWalletAddress ? (
        <GlassPanel className={`${ui.dashCardPad} text-center sm:p-8`}>
          <p className={ui.messageTitle}>Connect your wallet</p>
          <p className="mt-2 text-sm text-white/45">
            Connect your wallet to view your profile hub and progress.
          </p>
        </GlassPanel>
      ) : null}

      {showSkeleton ? <ProfileSkeleton /> : null}

      {normalizedWalletAddress && profileState.status === "error" ? (
        <GlassPanel className={`${ui.dashCardPad} text-center sm:p-8`}>
          <p className={ui.messageTitle}>Unable to load profile</p>
          <p className="mt-2 text-sm text-white/45">
            Please try again in a moment.
          </p>
        </GlassPanel>
      ) : null}

      {normalizedWalletAddress &&
      profileState.status === "ready" &&
      hydrated ? (
        <>
          <section className={ui.dashSection}>
            <ProfileHero
              address={profileState.profile.wallet_address}
              basename={walletScore.hero.basename}
              level={level}
              totalXp={totalXp}
              walletScore={walletScoreValue}
              walletScoreMax={walletScore.hero.maxScore}
              memberSince={formatMemberSince(profileState.profile.created_at)}
              rank={profileState.rank}
            />
          </section>

          <ProfileProgress
            totalXp={totalXp}
            streak={streak}
            completedQuests={profileState.profile.completed_quests.length}
            completedAchievements={achievementSummary.completed}
            totalAchievements={achievementSummary.total}
          />

          <ProfileBadges
            badges={badges}
            achievementTitles={achievementTitles}
          />

          <ProfileActivity
            metrics={activityMetrics}
            metricsLoading={metricsLoading}
            recentOnchain={walletScore.analytics.recentActivity}
            quests={quests}
          />

          <ProfileStatistics
            walletAgeLabel={walletScore.live.walletAgeLabel}
            activeDays={walletScore.live.activeDays}
            transactions={walletScore.live.transactionCount}
            ecosystemScore={walletScore.live.ecosystemScore}
            loading={metricsLoading}
          />

          <ProfileShare
            address={profileState.profile.wallet_address}
            basename={walletScore.hero.basename}
            level={level}
            totalXp={totalXp}
          />
        </>
      ) : null}
    </PageShell>
  );
}
