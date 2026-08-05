"use client";

import CommunityQuestCards from "@/components/CommunityQuestCards";
import ClaimNftQuestCard from "@/components/ClaimNftQuestCard";
import DeployContractQuestCard from "@/components/DeployContractQuestCard";
import BridgeToBaseQuestCard from "@/components/BridgeToBaseQuestCard";
import FirstSwapQuestCard from "@/components/FirstSwapQuestCard";
import GlassPanel from "@/components/GlassPanel";
import MintGenesisQuestCard from "@/components/MintGenesisQuestCard";
import X402PaymentQuestCard from "@/components/X402PaymentQuestCard";
import LevelProgressBar from "@/components/LevelProgressBar";
import LevelUpCelebration from "@/components/LevelUpCelebration";
import PageShell from "@/components/PageShell";
import QuestCard from "@/components/QuestCard";
import BqrBalanceCard from "@/components/dashboard/BqrBalanceCard";
import GenesisCollectionCard from "@/components/dashboard/GenesisCollectionCard";
import GenesisBonusActiveBadge from "@/components/genesis/GenesisBonusActiveBadge";
import GenesisQuestsSection from "@/components/genesis/GenesisQuestsSection";
import AnimatedCounter from "@/components/ui/AnimatedCounter";
import ScoreRing from "@/components/ui/ScoreRing";
import { useQuestEngine } from "@/hooks/useQuestEngine";
import { getLevel, getProgressPercent } from "@/lib/levels";
import type { QuestId } from "@/lib/quest-engine";
import { ui } from "@/lib/ui-styles";
import { Suspense } from "react";

function DashboardSkeleton() {
  return (
    <>
      <section className={ui.dashSection}>
        <div className={ui.gridCards}>
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className={`${ui.glassCard} min-h-[10rem] animate-pulse ${ui.dashCardPad}`}
            >
              <div className="h-3 w-28 rounded bg-white/10" />
              <div className="mt-4 h-12 rounded bg-white/10" />
              <div className="mt-auto h-10 w-full rounded bg-white/10 pt-6" />
            </div>
          ))}
        </div>
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

  // Dashboard-only fixed onboarding order; completed quests stay in place.
  const dailyCheckInQuest = quests.find((quest) => quest.id === "daily-check-in");
  const exploreBaseQuest = quests.find((quest) => quest.id === "explore-base");

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

          {/* Onboarding quests — always first, fixed order, never reordered */}
          <section className={ui.dashSection}>
            <div className={ui.sectionHeaderWrap}>
              <p className={ui.sectionHeading}>Start here</p>
              <h2 className={ui.sectionTitle}>Onboarding Quests</h2>
              <p className={ui.sectionDescription}>
                Complete these core quests to earn XP and get started on Base.
              </p>
            </div>

            <div className={ui.gridCards}>
              {dailyCheckInQuest ? (
                <QuestCard
                  questId={dailyCheckInQuest.id}
                  title={dailyCheckInQuest.title}
                  description={dailyCheckInQuest.description}
                  reward={dailyCheckInQuest.reward}
                  status={dailyCheckInQuest.status}
                  ctaLabel={dailyCheckInQuest.ctaLabel}
                  onServerProgress={applyServerProgress}
                />
              ) : null}
              <DeployContractQuestCard
                quest={quests.find((quest) => quest.id === "deploy-contract")}
                onCompleted={applyServerProgress}
              />
              <MintGenesisQuestCard
                quest={quests.find((quest) => quest.id === "mint-genesis")}
                onCompleted={applyServerProgress}
              />
              <X402PaymentQuestCard
                quest={quests.find((quest) => quest.id === "x402-payment")}
                onCompleted={applyServerProgress}
              />
              <FirstSwapQuestCard
                quest={quests.find((quest) => quest.id === "first-swap")}
              />
              <BridgeToBaseQuestCard
                quest={quests.find((quest) => quest.id === "bridge-to-base")}
              />
              <ClaimNftQuestCard
                quest={quests.find((quest) => quest.id === "claim-nft")}
                onCompleted={applyServerProgress}
              />
              {exploreBaseQuest ? (
                <QuestCard
                  questId={exploreBaseQuest.id}
                  title={exploreBaseQuest.title}
                  description={exploreBaseQuest.description}
                  reward={exploreBaseQuest.reward}
                  status={exploreBaseQuest.status}
                  ctaLabel={exploreBaseQuest.ctaLabel}
                  onAction={() =>
                    handleQuestAction(exploreBaseQuest.id as QuestId)
                  }
                />
              ) : null}
            </div>
          </section>

          {/* Community Quests */}
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

          {/* Genesis Exclusive Quests */}
          <GenesisQuestsSection />

          {/* Your Progress */}
          <section className={ui.dashSection}>
            <div className={ui.sectionHeaderWrap}>
              <p className={ui.sectionHeading}>Overview</p>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className={ui.sectionTitle}>Your Progress</h2>
                <GenesisBonusActiveBadge />
              </div>
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

          {/* Token + Genesis Collection */}
          <section className={`${ui.dashSection} grid grid-cols-1 items-stretch gap-6 md:grid-cols-2`}>
            <div className={ui.dashPairCell}>
              <div className={ui.dashPairHeader}>
                <p className={ui.sectionHeading}>Token</p>
                <h2 className={ui.sectionTitle}>BQR Balance</h2>
              </div>
              <div className={ui.dashPairBody}>
                <BqrBalanceCard />
              </div>
            </div>
            <div className={ui.dashPairCell}>
              <div className={ui.dashPairHeader}>
                <p className={ui.sectionHeading}>NFT</p>
                <h2 className={ui.sectionTitle}>Genesis Collection</h2>
              </div>
              <div className={ui.dashPairBody}>
                <GenesisCollectionCard />
              </div>
            </div>
          </section>

          {/* Community Footer rendered by PageShell */}
        </>
      )}
    </PageShell>
  );
}
