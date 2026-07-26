"use client";

import CommunityQuestCards, {
  filterBuilderQuests,
} from "@/components/CommunityQuestCards";
import ConnectWithBuilder from "@/components/ConnectWithBuilder";
import ClaimNftQuestCard from "@/components/ClaimNftQuestCard";
import DeployContractQuestCard from "@/components/DeployContractQuestCard";
import BridgeToBaseCard from "@/components/BridgeToBaseCard";
import BridgeToBaseQuestCard from "@/components/BridgeToBaseQuestCard";
import FirstSwapQuestCard from "@/components/FirstSwapQuestCard";
import GlassPanel from "@/components/GlassPanel";
import X402PaymentQuestCard from "@/components/X402PaymentQuestCard";
import LevelProgressBar from "@/components/LevelProgressBar";
import LevelUpCelebration from "@/components/LevelUpCelebration";
import PageShell from "@/components/PageShell";
import QuestCard from "@/components/QuestCard";
import QuickSwapCard from "@/components/QuickSwapCard";
import WalletStatusCard from "@/components/WalletStatusCard";
import { useQuestEngine } from "@/hooks/useQuestEngine";
import { getLevel } from "@/lib/levels";
import type { QuestId } from "@/lib/quest-engine";
import { ui } from "@/lib/ui-styles";
import Link from "next/link";
import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";

function DashboardSkeleton() {
  return (
    <>
      <section className="animate-pulse space-y-3">
        <div className="mx-auto h-3 w-20 rounded bg-white/10 sm:mx-0" />
        <div className="mx-auto h-8 w-56 rounded bg-white/10 sm:mx-0" />
        <div className="mx-auto h-4 w-72 max-w-full rounded bg-white/10 sm:mx-0" />
      </section>

      <section className={ui.gridStats}>
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className={`${ui.glassCard} min-h-[9rem] animate-pulse p-5 sm:p-6`}
          >
            <div className="h-3 w-24 rounded bg-white/10" />
            <div className="mt-auto h-8 w-16 rounded bg-white/10 pt-6" />
          </div>
        ))}
      </section>

      <section className={`${ui.glassCard} animate-pulse p-5 sm:p-6`}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="h-12 rounded bg-white/10" />
          <div className="h-12 rounded bg-white/10" />
          <div className="h-12 rounded bg-white/10" />
        </div>
      </section>
    </>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const {
    hydrated,
    quests,
    progressStats,
    totalXp,
    levelUpLevel,
    clearLevelUpCelebration,
    handleQuestAction,
    applyServerProgress,
  } = useQuestEngine();

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") {
      return;
    }
    if (window.location.hash !== "#quick-swap") {
      return;
    }
    window.requestAnimationFrame(() => {
      document
        .getElementById("quick-swap")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [hydrated]);

  return (
    <PageShell>
      {!hydrated ? (
        <DashboardSkeleton />
      ) : (
        <>
          {levelUpLevel ? (
            <LevelUpCelebration
              level={levelUpLevel}
              onDismiss={clearLevelUpCelebration}
            />
          ) : null}

          {/* Hero + builder card; tighter gap into Your Progress */}
          <div className="flex flex-col gap-8 sm:gap-9 lg:gap-10">
            <section className="grid grid-cols-1 items-start gap-3 text-center sm:text-left lg:grid-cols-[minmax(0,1.05fr)_minmax(22rem,1.2fr)] lg:gap-6">
              <div>
                <p className={ui.sectionHeading}>Dashboard</p>
                <h1 className={ui.pageTitle}>BaseQuest Rewards</h1>
                <p className={ui.pageSubtitle}>
                  Daily rewards and engagement for the Base ecosystem.
                </p>

                {/* Mobile builder card — below description, no extra bottom margin */}
                <div className="mt-3 lg:hidden">
                  <ConnectWithBuilder variant="mobile" />
                </div>
              </div>

              {/* Desktop builder card — title-aligned, wider fill */}
              <div className="hidden w-full self-start lg:block lg:mt-[1.65rem]">
                <ConnectWithBuilder variant="desktop" />
              </div>
            </section>

            <section>
              <div className={ui.sectionHeaderWrap}>
                <p className={ui.sectionHeading}>Overview</p>
                <h2 className={ui.sectionTitle}>Your Progress</h2>
              </div>

              <div className={ui.gridStats}>
                {progressStats.map((stat) => (
                  <article key={stat.label} className={ui.statCard}>
                    <p className={ui.statLabel}>{stat.label}</p>
                    <p className={ui.statValue}>{stat.value}</p>
                  </article>
                ))}
                <article className={ui.statCard}>
                  <p className={ui.statLabel}>Current Level</p>
                  <div className="mt-auto flex flex-1 flex-col pt-3">
                    <p className="font-sans text-2xl font-bold tabular-nums tracking-tight text-white sm:text-3xl">
                      Level {getLevel(totalXp)}
                    </p>
                    <p className="mt-1 text-sm text-white/45">{totalXp} XP</p>
                    <LevelProgressBar totalXp={totalXp} />
                  </div>
                </article>
              </div>
            </section>
          </div>

          <section>
            <div className={ui.sectionHeaderWrap}>
              <p className={ui.sectionHeading}>Wallet</p>
              <h2 className={ui.sectionTitle}>Wallet Status</h2>
            </div>

            <WalletStatusCard />
          </section>

          <section>
            <div className={ui.sectionHeaderWrap}>
              <p className={ui.sectionHeading}>Analytics</p>
              <h2 className={ui.sectionTitle}>Base Wallet Score</h2>
            </div>

            <Link href="/base-wallet-score" className="block">
              <GlassPanel interactive className="p-5 sm:p-6">
                <p className={ui.statLabel}>BaseQuest 2.0</p>
                <p className="mt-2 font-sans text-xl font-bold tracking-tight text-white sm:text-2xl">
                  Base Wallet Score
                </p>
                <p className="mt-2 text-sm leading-relaxed text-white/55 sm:text-base">
                  Open your premium Base wallet analytics dashboard — score,
                  portfolio, activity, and insights.
                </p>
                <span className={`mt-4 inline-flex ${ui.secondaryButton}`}>
                  View Score
                </span>
              </GlassPanel>
            </Link>
          </section>

          <section>
            <div className={ui.sectionHeaderWrap}>
              <p className={ui.sectionHeading}>Swap</p>
              <h2 className={ui.sectionTitle}>Quick Swap</h2>
              <p className={ui.sectionDescription}>
                Swap tokens on Base Mainnet with live LI.FI routing.
              </p>
            </div>
            <QuickSwapCard onFirstSwapQuestCompleted={applyServerProgress} />
          </section>

          <section>
            <div className={ui.sectionHeaderWrap}>
              <p className={ui.sectionHeading}>Bridge</p>
              <h2 className={ui.sectionTitle}>Bridge to Base</h2>
              <p className={ui.sectionDescription}>
                Bridge assets from Ethereum, Arbitrum, Optimism, or Polygon to
                Base with live LI.FI routing.
              </p>
            </div>
            <BridgeToBaseCard onBridgeQuestCompleted={applyServerProgress} />
          </section>

          <section>
            <div className={ui.sectionHeaderWrap}>
              <p className={ui.sectionHeading}>Community</p>
              <h2 className={ui.sectionTitle}>Community Quests</h2>
              <p className={ui.sectionDescription}>
                Follow BaseQuest Rewards on social and stay connected with the
                community.
              </p>
            </div>
            <div className={ui.gridCards}>
              <Suspense fallback={null}>
                <CommunityQuestCards
                  quests={quests}
                  onFollowXCompleted={applyServerProgress}
                />
              </Suspense>
            </div>
          </section>

          <section>
            <div className={ui.sectionHeaderWrap}>
              <p className={ui.sectionHeading}>Builder</p>
              <h2 className={ui.sectionTitle}>Builder Quests</h2>
              <p className={ui.sectionDescription}>
                Complete builder quests to earn XP and grow your streak.
              </p>
            </div>

            <div className={ui.gridCards}>
              <DeployContractQuestCard
                quest={quests.find((quest) => quest.id === "deploy-contract")}
                onCompleted={applyServerProgress}
              />
              <ClaimNftQuestCard
                quest={quests.find((quest) => quest.id === "claim-nft")}
                onCompleted={applyServerProgress}
              />
              <X402PaymentQuestCard
                quest={quests.find((quest) => quest.id === "x402-payment")}
                onCompleted={applyServerProgress}
              />
              <FirstSwapQuestCard
                quest={quests.find((quest) => quest.id === "first-swap")}
                scrollToSwap
              />
              <BridgeToBaseQuestCard
                quest={quests.find((quest) => quest.id === "bridge-to-base")}
                scrollToBridge
              />
              {filterBuilderQuests(quests).map((quest) => (
                <QuestCard
                  key={quest.id}
                  questId={quest.id}
                  title={quest.title}
                  description={quest.description}
                  reward={quest.reward}
                  status={quest.status}
                  ctaLabel={quest.ctaLabel}
                  onAction={() => {
                    if (quest.id === "view-leaderboard") {
                      router.push("/leaderboard");
                      return;
                    }

                    handleQuestAction(quest.id as QuestId);
                  }}
                />
              ))}
            </div>
          </section>
        </>
      )}
    </PageShell>
  );
}
