"use client";

import QuestCard from "@/components/QuestCard";
import X402PaymentModal from "@/components/X402PaymentModal";
import type { QuestProgress, QuestStatus, QuestViewModel } from "@/lib/quest-engine";
import { useState } from "react";

type X402PaymentQuestCardProps = {
  quest?: QuestViewModel;
  onCompleted: (progress: QuestProgress) => void;
};

/**
 * Make an x402 Payment quest card — opens demo payment modal.
 */
export default function X402PaymentQuestCard({
  quest,
  onCompleted,
}: X402PaymentQuestCardProps) {
  const [open, setOpen] = useState(false);
  const status: QuestStatus = quest?.status ?? "available";
  const reward = quest?.reward ?? "+100 XP";
  const title = quest?.title ?? "Make an x402 Payment";
  const description =
    quest?.description ??
    "Call the premium x402 endpoint and complete one successful payment on Base Mainnet.";
  const ctaLabel =
    status === "completed"
      ? "Completed"
      : status === "locked"
        ? "Locked"
        : (quest?.ctaLabel ?? "Start");

  return (
    <>
      <QuestCard
        questId="x402-payment"
        title={title}
        description={description}
        reward={reward}
        status={status}
        ctaLabel={ctaLabel}
        frequencyLabel="One-Time"
        onAction={() => {
          if (status === "locked") {
            return;
          }
          setOpen(true);
        }}
      />
      <X402PaymentModal
        open={open}
        onClose={() => setOpen(false)}
        questStatus={status}
        onQuestCompleted={onCompleted}
      />
    </>
  );
}
