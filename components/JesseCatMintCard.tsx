"use client";

import JesseCatMintModal from "@/components/JesseCatMintModal";
import QuestCard from "@/components/QuestCard";
import type { QuestProgress } from "@/lib/quest-engine";
import { useState } from "react";

const JESSECAT_MINT_REWARD_XP = 100;

type JesseCatMintCardProps = {
  onCompleted: (progress: QuestProgress) => void;
};

/**
 * JesseCat mint — repeatable +100 XP after each confirmed mint transaction.
 * Never marked permanently completed.
 */
export default function JesseCatMintCard({
  onCompleted,
}: JesseCatMintCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <QuestCard
        questId="jessecat-mint"
        title="Mint JesseCat"
        description="Mint JesseCat on Base through the official OpenSea Drop. Earn +100 XP for every successful mint."
        reward={`+${JESSECAT_MINT_REWARD_XP} XP`}
        status="available"
        ctaLabel="Mint JesseCat"
        frequencyLabel="Repeatable"
        onAction={() => setOpen(true)}
      />
      <JesseCatMintModal
        open={open}
        onClose={() => setOpen(false)}
        onCompleted={onCompleted}
      />
    </>
  );
}
