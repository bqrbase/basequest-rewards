"use client";

import JesseCatMintModal from "@/components/JesseCatMintModal";
import QuestCard from "@/components/QuestCard";
import { useState } from "react";

/**
 * JesseCat mint entry — not a quest; opens the OpenSea Drop mint modal.
 */
export default function JesseCatMintCard() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <QuestCard
        questId="jessecat-mint"
        title="Mint JesseCat"
        description="Mint JesseCat on Base through the official OpenSea Drop — same contract and supply as OpenSea."
        reward="OpenSea Drop"
        status="available"
        ctaLabel="Mint JesseCat"
        frequencyLabel="Public"
        onAction={() => setOpen(true)}
      />
      <JesseCatMintModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
