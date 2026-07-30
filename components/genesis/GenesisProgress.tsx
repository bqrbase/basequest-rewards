"use client";

import type { GenesisSupplyState } from "@/hooks/useGenesisSupply";
import GlassPanel from "@/components/GlassPanel";
import { ui } from "@/lib/ui-styles";

type GenesisProgressProps = {
  supply: GenesisSupplyState;
};

export default function GenesisProgress({ supply }: GenesisProgressProps) {
  const minted =
    supply.status === "ready" ? Number(supply.totalMinted) : 0;
  const remaining =
    supply.status === "ready" ? Number(supply.remaining) : 1000;
  const progress =
    supply.status === "ready" ? supply.progress : 0;

  return (
    <section className={ui.dashSection}>
      <div className={ui.sectionHeaderWrap}>
        <p className={ui.sectionHeading}>Progress</p>
        <h2 className={ui.sectionTitle}>Collection Progress</h2>
        <p className={ui.sectionDescription}>
          Tracking Genesis mint progress toward the full 1,000 supply.
        </p>
      </div>

      <GlassPanel className={ui.dashCardPad}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className={ui.statLabel}>Minted</p>
            <p className="mt-1 font-sans text-xl font-bold text-white sm:text-2xl">
              {supply.status === "loading" ? "…" : `${minted} Minted`}
            </p>
          </div>
          <div className="text-right">
            <p className={ui.statLabel}>Remaining</p>
            <p className="mt-1 font-sans text-xl font-bold text-white/80 sm:text-2xl">
              {supply.status === "loading" ? "…" : `${remaining} Remaining`}
            </p>
          </div>
        </div>

        <div
          className="mt-5 h-3 overflow-hidden rounded-full border border-white/10 bg-white/[0.06]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
          aria-label="Genesis collection mint progress"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-base-blue via-indigo-500 to-cyan-400 transition-[width] duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </GlassPanel>
    </section>
  );
}
