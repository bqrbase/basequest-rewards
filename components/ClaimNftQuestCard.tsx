"use client";

import ClaimNftModal from "@/components/ClaimNftModal";
import QuestCard from "@/components/QuestCard";
import type { QuestProgress, QuestStatus, QuestViewModel } from "@/lib/quest-engine";
import { useState } from "react";

type ClaimNftQuestCardProps = {
  quest?: QuestViewModel;
  onCompleted: (progress: QuestProgress) => void;
};

/**
 * Claim NFT quest card — opens mint modal after Deploy Contract is complete.
 */
export default function ClaimNftQuestCard({
  quest,
  onCompleted,
}: ClaimNftQuestCardProps) {
  const [open, setOpen] = useState(false);
  const status: QuestStatus = quest?.status ?? "locked";
  const reward = quest?.reward ?? "+50 XP";
  const title = quest?.title ?? "Claim NFT";
  const description =
    quest?.description ??
    "Mint your BaseQuest Builder Badge NFT after deploying your first contract.";
  const ctaLabel =
    status === "completed"
      ? "Completed"
      : status === "locked"
        ? "Locked"
        : (quest?.ctaLabel ?? "Claim NFT");

  return (
    <>
      <QuestCard
        questId="claim-nft"
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
      <ClaimNftModal
        open={open}
        onClose={() => setOpen(false)}
        questStatus={status}
        onQuestCompleted={onCompleted}
      />
    </>
  );
}
