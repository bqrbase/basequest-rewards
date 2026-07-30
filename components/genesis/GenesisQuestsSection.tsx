"use client";

import GenesisQuestCard from "@/components/genesis/GenesisQuestCard";
import { useGenesisQuests } from "@/hooks/useGenesisQuests";
import { ui } from "@/lib/ui-styles";

type GenesisQuestsSectionProps = {
  className?: string;
};

/**
 * Holder-only Genesis exclusive quests section.
 * Renders nothing for non-holders (existing quest UX unchanged).
 */
export default function GenesisQuestsSection({
  className = "",
}: GenesisQuestsSectionProps) {
  const { loading, quests } = useGenesisQuests();

  if (loading || quests.length === 0) {
    return null;
  }

  return (
    <section className={`${ui.dashSection} ${className}`.trim()}>
      <div className={ui.sectionHeaderWrap}>
        <p className={ui.sectionHeading}>Genesis</p>
        <h2 className={ui.sectionTitle}>Genesis Exclusive Quests</h2>
        <p className={ui.sectionDescription}>
          Exclusive for Genesis Holders — preview quests unlocking soon.
        </p>
      </div>
      <div className={ui.gridCards}>
        {quests.map((quest) => (
          <GenesisQuestCard key={quest.id} quest={quest} />
        ))}
      </div>
    </section>
  );
}
