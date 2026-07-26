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
import BqrBalanceCard from "@/components/dashboard/BqrBalanceCard";
import DashboardLeaderboardPreview from "@/components/dashboard/DashboardLeaderboardPreview";
import DashboardRecentActivity from "@/components/dashboard/DashboardRecentActivity";
import AnimatedCounter from "@/components/ui/AnimatedCounter";
import ScoreRing from "@/components/ui/ScoreRing";
import { useQuestEngine } from "@/hooks/useQuestEngine";
import { getLevel, getProgressPercent } from "@/lib/levels";
import type { QuestId } from "@/lib/quest-engine";
import { ui } from "@/lib/ui-styles";
import Link from "next/link";
import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";

function DashboardSkeleton() {
  return (
    <>
      <section className={`${ui.dashSection} animate-pulse space-y-3`}>
        <div className="mx-auto h-3 w-20 rounded bg-white/10 sm:mx-0" />
        <div className="mx-auto h-8 w-56 rounded bg-white/10 sm:mx-0" />
        <div className="mx-auto h-4 w-72 max-w-full rounded bg-white/10 sm:mx-0" />
      </section>

      <section className={`${ui.dashSection} ${ui.gridStats}`}>
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className={`${ui.glassCard} min-h-[9rem] animate-pulse ${ui.dashCardPad}`}
          >
            <div className="h-3 w-24 rounded bg-white/10" />
            <div className="mt-auto h-8 w-16 rounded bg-white/10 pt-6" />
          </div>
        ))}
      </section>

      <section className={`${ui.dashSection} ${ui.dashPairGrid}`}>
        {Array.from({ length: 2 }, (_, index) => (
          <div
            key={index}
            className={`${ui.glassCard} min-h-[10rem] animate-pulse ${ui.dashCardPad}`}
          >
            <div className="h-3 w-24 rounded bg-white/10" />
            <div className="mt-4 h-16 rounded bg-white/10" />
          </div>
        ))}
      </section>
    </>
  );
}

function parseStatNumber(value: string): number | null {
  const match = value.replace(/,/g, "").match(/-?\d+/);
  if (!match) {
    return null;
  }
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
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

  const level = getLevel(totalXp);
  const levelProgress = getProgressPercent(totalXp);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") {
      return;
    }
    const hash = window.location.hash;
    if (hash !== "#quick-swap" && hash !== "#bridge-to-base") {
      return;
    }
    window.requestAnimationFrame(() => {
      document
        .getElementById(hash.slice(1))
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

          {/* Hero */}
          <section className={`${ui.dashSection} grid grid-cols-1 items-start gap-4 text-center sm:text-left lg:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)] lg:gap-6`}>
            <div>
              <p className={ui.sectionHeading}>Dashboard</p>
              <h1 className={ui.pageTitle}>BaseQuest Rewards</h1>
              <p className={ui.pageSubtitle}>
                Daily rewards and engagement for the Base ecosystem.
              </p>
              <div className="mt-3 lg:hidden">
                <ConnectWithBuilder variant="mobile" />
              </div>
            </div>
            <div className="hidden w-full self-start lg:block lg:mt-[1.65rem]">
              <ConnectWithBuilder variant="desktop" />
            </div>
          </section>

          {/* Progress + XP */}
          <section className={ui.dashSection}>
            <div className={ui.sectionHeaderWrap}>
              <p className={ui.sectionHeading}>Overview</p>
              <h2 className={ui.sectionTitle}>Your Progress</h2>
            </div>

            <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-[minmax(0,1.35fr)_minmax(14rem,0.85fr)] md:gap-4 lg:gap-5">
              <div className={ui.gridStats}>
                {progressStats.map((stat) => {
                  const numeric = parseStatNumber(stat.value);
                  return (
                    <article key={stat.label} className={ui.statCard}>
                      <p className={ui.statLabel}>{stat.label}</p>
                      <p className={ui.statValue}>
                        {numeric !== null ? (
                          <AnimatedCounter
                            value={numeric}
                            format={(n) =>
                              stat.value.includes("days")
                                ? `${n} days`
                                : n.toLocaleString()
                            }
                          />
                        ) : (
                          stat.value
                        )}
                      </p>
                    </article>
                  );
                })}
                <article className={ui.statCard}>
                  <p className={ui.statLabel}>Current Level</p>
                  <div className="mt-auto flex flex-1 flex-col pt-3">
                    <p className="font-sans text-2xl font-bold tabular-nums tracking-tight text-white sm:text-3xl">
                      Level{" "}
                      <AnimatedCounter value={level} format={(n) => String(n)} />
                    </p>
                    <p className="mt-1 text-sm text-white/45">
                      <AnimatedCounter
                        value={totalXp}
                        format={(n) => `${n.toLocaleString()} XP`}
                      />
                    </p>
                  </div>
                </article>
              </div>

              <GlassPanel
                className={`h-full justify-between ${ui.dashCardPad}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={ui.statLabel}>XP Progress</p>
                    <p className="mt-1 font-sans text-lg font-semibold text-white">
                      Level journey
                    </p>
                  </div>
                  <ScoreRing
                    value={levelProgress}
                    size={88}
                    strokeWidth={8}
                    label={`Level progress ${Math.round(levelProgress)} percent`}
                    center={
                      <>
                        <span className="font-sans text-lg font-bold tabular-nums text-white">
                          {Math.round(levelProgress)}%
                        </span>
                      </>
                    }
                  />
                </div>
                <div className="mt-auto pt-4">
                  <LevelProgressBar totalXp={totalXp} />
                </div>
              </GlassPanel>
            </div>
          </section>

          {/* Wallet + Score */}
          <section className={`${ui.dashSection} ${ui.dashPairGrid}`}>
            <div className={ui.dashPairCell}>
              <div className={ui.dashPairHeader}>
                <p className={ui.sectionHeading}>Wallet</p>
                <h2 className={ui.sectionTitle}>Wallet Status</h2>
              </div>
              <div className={ui.dashPairBody}>
                <WalletStatusCard />
              </div>
            </div>

            <div className={ui.dashPairCell}>
              <div className={ui.dashPairHeader}>
                <p className={ui.sectionHeading}>Analytics</p>
                <h2 className={ui.sectionTitle}>Base Wallet Score</h2>
              </div>
              <div className={ui.dashPairBody}>
                <Link href="/base-wallet-score" className="flex h-full min-h-0 flex-col">
                  <GlassPanel
                    interactive
                    className={`h-full ${ui.dashCardPad}`}
                  >
                    <div className="flex h-full flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-5">
                      <ScoreRing
                        value={levelProgress}
                        size={120}
                        strokeWidth={10}
                        label="Open Base Wallet Score analytics"
                        center={
                          <>
                            <span className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-white/45">
                              Score
                            </span>
                            <span className="mt-0.5 font-sans text-sm font-bold text-white">
                              Open
                            </span>
                          </>
                        }
                      />
                      <div className="flex min-w-0 flex-1 flex-col text-center sm:text-left">
                        <p className={ui.statLabel}>BaseQuest 2.0</p>
                        <p className="mt-1 font-sans text-xl font-bold tracking-tight text-white">
                          Base Wallet Score
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-white/55">
                          Premium Base analytics — score, portfolio, activity,
                          and insights.
                        </p>
                        <span
                          className={`mt-auto inline-flex pt-4 ${ui.secondaryButton}`}
                        >
                          View Score
                        </span>
                      </div>
                    </div>
                  </GlassPanel>
                </Link>
              </div>
            </div>
          </section>

          {/* BQR Balance */}
          <section className={ui.dashSection}>
            <div className={ui.sectionHeaderWrap}>
              <p className={ui.sectionHeading}>Token</p>
              <h2 className={ui.sectionTitle}>BQR Balance</h2>
            </div>
            <div className="grid grid-cols-1 items-stretch gap-4 md:max-w-xl">
              <BqrBalanceCard />
            </div>
          </section>

          {/* Trade tools */}
          <section className={`${ui.dashSection} ${ui.dashPairGrid}`}>
            <div className={ui.dashPairCell}>
              <div className={ui.dashPairHeaderTall}>
                <p className={ui.sectionHeading}>Swap</p>
                <h2 className={ui.sectionTitle}>Quick Swap</h2>
                <p className={ui.sectionDescription}>
                  Swap tokens on Base Mainnet with live LI.FI routing.
                </p>
              </div>
              <div className={ui.dashPairBody}>
                <QuickSwapCard onFirstSwapQuestCompleted={applyServerProgress} />
              </div>
            </div>
            <div className={ui.dashPairCell}>
              <div className={ui.dashPairHeaderTall}>
                <p className={ui.sectionHeading}>Bridge</p>
                <h2 className={ui.sectionTitle}>Bridge to Base</h2>
                <p className={ui.sectionDescription}>
                  Bridge from Ethereum, Arbitrum, Optimism, or Polygon to Base.
                </p>
              </div>
              <div className={ui.dashPairBody}>
                <BridgeToBaseCard onBridgeQuestCompleted={applyServerProgress} />
              </div>
            </div>
          </section>

          {/* Leaderboard + Activity */}
          <section className={`${ui.dashSection} ${ui.dashPairGrid}`}>
            <div className={ui.dashPairCell}>
              <div className={ui.dashPairHeader}>
                <p className={ui.sectionHeading}>Community</p>
                <h2 className={ui.sectionTitle}>Leaderboard</h2>
              </div>
              <div className={ui.dashPairBody}>
                <DashboardLeaderboardPreview />
              </div>
            </div>
            <div className={ui.dashPairCell}>
              <div className={ui.dashPairHeader}>
                <p className={ui.sectionHeading}>History</p>
                <h2 className={ui.sectionTitle}>Recent Activity</h2>
              </div>
              <div className={ui.dashPairBody}>
                <DashboardRecentActivity quests={quests} />
              </div>
            </div>
          </section>

          {/* Community quests */}
          <section className={ui.dashSection}>
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

          {/* Builder quests */}
          <section className={ui.dashSection}>
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
