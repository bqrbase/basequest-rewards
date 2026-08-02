"use client";

import QuestCard from "@/components/QuestCard";
import type { QuestStatus, QuestViewModel } from "@/lib/quest-engine";
import { useRouter } from "next/navigation";

type FirstSwapQuestCardProps = {
  quest?: QuestViewModel;
};

/**
 * Complete your first swap — completed via Quick Swap after on-chain confirmation.
 */
export default function FirstSwapQuestCard({
  quest,
}: FirstSwapQuestCardProps) {
  const router = useRouter();
  const status: QuestStatus = quest?.status ?? "available";
  const reward = quest?.reward ?? "+25 XP";
  const title = quest?.title ?? "Complete your first swap";
  const description =
    quest?.description ??
    "Swap tokens on Base Mainnet with Quick Swap. Completes only after a confirmed on-chain transaction.";
  const ctaLabel =
    status === "completed"
      ? "Completed"
      : status === "locked"
        ? "Locked"
        : (quest?.ctaLabel ?? "Swap");

  return (
    <QuestCard
      questId="first-swap"
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

        router.push("/swap");
      }}
    />
  );
}
