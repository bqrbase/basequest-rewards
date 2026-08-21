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
 * Deploy Contract — permanent action card.
 * Always available for unlimited deploys; XP is awarded once per UTC day server-side.
 */
export default function DeployContractQuestCard({
  quest,
  onCompleted,
}: DeployContractQuestCardProps) {
  const [open, setOpen] = useState(false);
  // Presentation is always active — never show Completed / disabled CTA.
  const status: QuestStatus = "available";
  const reward = quest?.reward ?? "+5 XP";
  const title = quest?.title ?? "Deploy Contract";
  const description =
    quest?.description ??
    "Choose a contract template and deploy your first contract on Base.";
  const ctaLabel = "Deploy Contract";

  return (
    <>
      <QuestCard
        questId="deploy-contract"
        title={title}
        description={description}
        reward={reward}
        status={status}
        ctaLabel={ctaLabel}
        frequencyLabel="Daily XP"
        onAction={() => {
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
