"use client";

import PageShell from "@/components/PageShell";
import QuickSwapCard from "@/components/QuickSwapCard";
import { useQuestEngine } from "@/hooks/useQuestEngine";
import { ui } from "@/lib/ui-styles";

export default function SwapPage() {
  const { applyServerProgress } = useQuestEngine();

  return (
    <PageShell>
      <section className={`${ui.dashSection} text-center sm:text-left`}>
        <p className={ui.sectionHeading}>Swap</p>
        <h1 className={ui.pageTitle}>Quick Swap</h1>
        <p className={ui.pageSubtitle}>
          Swap tokens on Base Mainnet with live LI.FI routing.
        </p>
      </section>

      <section className={ui.dashSection}>
        <div className="mx-auto w-full max-w-xl">
          <QuickSwapCard onFirstSwapQuestCompleted={applyServerProgress} />
        </div>
      </section>
    </PageShell>
  );
}
