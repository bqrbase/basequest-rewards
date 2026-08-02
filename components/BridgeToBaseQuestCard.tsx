"use client";

import QuestCard from "@/components/QuestCard";
import type { QuestStatus, QuestViewModel } from "@/lib/quest-engine";
import { useRouter } from "next/navigation";

type BridgeToBaseQuestCardProps = {
  quest?: QuestViewModel;
};

/**
 * Bridge assets to Base — completed via Bridge card after destination settlement.
 */
export default function BridgeToBaseQuestCard({
  quest,
}: BridgeToBaseQuestCardProps) {
  const router = useRouter();
  const status: QuestStatus = quest?.status ?? "available";
  const reward = quest?.reward ?? "+30 XP";
  const title = quest?.title ?? "Bridge assets to Base";
  const description =
    quest?.description ??
    "Bridge assets to Base Mainnet. Completes only after destination settlement on Base (bridgeStatus completed).";
  const ctaLabel =
    status === "completed"
      ? "Completed"
      : status === "locked"
        ? "Locked"
        : (quest?.ctaLabel ?? "Bridge");

  return (
    <QuestCard
      questId="bridge-to-base"
      title={title}
      description={description}
      reward={reward}
      status={status}
      ctaLabel={ctaLabel}
      frequencyLabel="One-Time"
      onAction={() => {
        if (status !== "available") {
          return;
        }

        router.push("/bridge");
      }}
    />
  );
}
