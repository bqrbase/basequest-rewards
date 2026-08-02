"use client";

import BridgeToBaseCard from "@/components/BridgeToBaseCard";
import PageShell from "@/components/PageShell";
import { useQuestEngine } from "@/hooks/useQuestEngine";
import { ui } from "@/lib/ui-styles";

export default function BridgePage() {
  const { applyServerProgress } = useQuestEngine();

  return (
    <PageShell>
      <section className={`${ui.dashSection} text-center sm:text-left`}>
        <p className={ui.sectionHeading}>Bridge</p>
        <h1 className={ui.pageTitle}>Bridge to Base</h1>
        <p className={ui.pageSubtitle}>
          Bridge from Ethereum, Arbitrum, Optimism, or Polygon to Base.
        </p>
      </section>

      <section className={ui.dashSection}>
        <div className="mx-auto w-full max-w-xl">
          <BridgeToBaseCard onBridgeQuestCompleted={applyServerProgress} />
        </div>
      </section>
    </PageShell>
  );
}
