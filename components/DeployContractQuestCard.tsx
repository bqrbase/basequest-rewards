"use client";

import DeployContractModal from "@/components/DeployContractModal";
import QuestCard from "@/components/QuestCard";
import type { QuestProgress, QuestStatus, QuestViewModel } from "@/lib/quest-engine";
import { useState } from "react";

type DeployContractQuestCardProps = {
  quest?: QuestViewModel;
  onCompleted: (progress: QuestProgress) => void;
};

/**
 * Deploy Contract quest card — opens template modal and runs Hello Base deploy.
 */
export default function DeployContractQuestCard({
  quest,
  onCompleted,
}: DeployContractQuestCardProps) {
  const [open, setOpen] = useState(false);
  const status: QuestStatus = quest?.status ?? "available";
  const reward = quest?.reward ?? "+50 XP";
  const title = quest?.title ?? "Deploy Contract";
  const description =
    quest?.description ??
    "Choose a contract template and deploy your first contract on Base.";
  const ctaLabel =
    status === "completed"
      ? "Completed"
      : (quest?.ctaLabel ?? "Deploy Contract");

  return (
    <>
      <QuestCard
        questId="deploy-contract"
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
      <DeployContractModal
        open={open}
        onClose={() => setOpen(false)}
        questStatus={status}
        onQuestCompleted={onCompleted}
      />
    </>
  );
}
