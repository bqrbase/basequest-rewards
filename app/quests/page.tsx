"use client";

import CommunityQuestCards, {
  filterBuilderQuests,
} from "@/components/CommunityQuestCards";
import ClaimNftQuestCard from "@/components/ClaimNftQuestCard";
import DeployContractQuestCard from "@/components/DeployContractQuestCard";
import FirstSwapQuestCard from "@/components/FirstSwapQuestCard";
import PageShell from "@/components/PageShell";
import X402PaymentQuestCard from "@/components/X402PaymentQuestCard";
import QuestCard from "@/components/QuestCard";
import { useQuestEngine } from "@/hooks/useQuestEngine";
import type { QuestId } from "@/lib/quest-engine";
import { ui } from "@/lib/ui-styles";
import { Suspense } from "react";
import { useRouter } from "next/navigation";

function QuestsSkeleton() {
  return (
    <div className={ui.gridCards}>
      {Array.from({ length: 4 }, (_, index) => (
        <div
          key={index}
          className={`${ui.glassCard} min-h-[12rem] animate-pulse p-5 sm:p-6`}
        >
          <div className="h-6 w-24 rounded bg-white/10" />
          <div className="mt-4 h-5 w-40 rounded bg-white/10" />
          <div className="mt-3 h-12 w-full rounded bg-white/10" />
          <div className="mt-6 h-11 w-full rounded-xl bg-white/10" />
        </div>
      ))}
    </div>
  );
}

export default function QuestsPage() {
  const router = useRouter();
  const { hydrated, quests, handleQuestAction, applyServerProgress } =
    useQuestEngine();

  return (
    <PageShell>
      <section className="text-center sm:text-left">
        <p className={ui.sectionHeading}>Quests</p>
        <h1 className={ui.pageTitle}>Start Earning</h1>
        <p className={ui.pageSubtitle}>
          Complete quests to earn XP and stay engaged with the Base ecosystem.
        </p>
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
        {!hydrated ? (
          <QuestsSkeleton />
        ) : (
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
        )}
      </section>
    </PageShell>
  );
}
