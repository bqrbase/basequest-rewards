"use client";

import QuestCard from "@/components/QuestCard";
import { useGenesisHolder } from "@/hooks/useGenesisHolder";
import { requestQuestCompletion } from "@/lib/quests/requestQuestCompletion";
import type {
  QuestProgress,
  QuestStatus,
  QuestViewModel,
} from "@/lib/quest-engine";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAccount } from "wagmi";

type MintGenesisQuestCardProps = {
  quest?: QuestViewModel;
  onCompleted: (progress: QuestProgress) => void;
};

/**
 * Mint Genesis NFT onboarding quest.
 * Completion is awarded only after server-side on-chain holder verification.
 * Client uses existing useGenesisHolder — does not duplicate balanceOf logic.
 */
export default function MintGenesisQuestCard({
  quest,
  onCompleted,
}: MintGenesisQuestCardProps) {
  const router = useRouter();
  const { address, status: walletStatus } = useAccount();
  const { isGenesisHolder, loading: holderLoading } = useGenesisHolder();
  const [isClaiming, setIsClaiming] = useState(false);

  const status: QuestStatus = quest?.status ?? "available";
  const reward = quest?.reward ?? "+100 XP";
  const title = quest?.title ?? "Mint Genesis NFT";
  const description =
    quest?.description ?? "Mint your BaseQuest Genesis NFT.";

  const canClaimXp =
    status === "available" &&
    walletStatus === "connected" &&
    Boolean(address) &&
    !holderLoading &&
    isGenesisHolder;

  const ctaLabel =
    status === "completed"
      ? "Completed"
      : status === "locked"
        ? "Locked"
        : isClaiming
          ? "Verifying…"
          : canClaimXp
            ? "Claim XP"
            : (quest?.ctaLabel ?? "Mint Genesis");

  async function claimMintGenesisXp() {
    if (!address || isClaiming || status !== "available") {
      return;
    }

    setIsClaiming(true);
    try {
      const result = await requestQuestCompletion({
        endpoint: "/api/quests/mint-genesis/complete",
        body: { wallet: address },
      });

      if (!result.success || !result.progress) {
        console.error(
          "[MintGenesisQuestCard] mint-genesis complete failed:",
          result.error,
        );
        return;
      }

      onCompleted(result.progress);
    } finally {
      setIsClaiming(false);
    }
  }

  return (
    <QuestCard
      questId="mint-genesis"
      title={title}
      description={description}
      reward={reward}
      status={status}
      ctaLabel={ctaLabel}
      frequencyLabel="One-Time"
      onAction={() => {
        if (status !== "available" || isClaiming) {
          return;
        }

        if (canClaimXp) {
          void claimMintGenesisXp();
          return;
        }

        router.push("/genesis");
      }}
    />
  );
}
