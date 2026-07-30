"use client";

import type { GenesisSupplyState } from "@/hooks/useGenesisSupply";
import { ui } from "@/lib/ui-styles";

type GenesisStatsProps = {
  supply: GenesisSupplyState;
};

export default function GenesisStats({ supply }: GenesisStatsProps) {
  const mintedLabel =
    supply.status === "ready"
      ? `${supply.totalMinted.toString()} / ${supply.maxSupply.toString()}`
      : supply.status === "loading"
        ? "…"
        : "—";
  const remainingLabel =
    supply.status === "ready"
      ? supply.remaining.toString()
      : supply.status === "loading"
        ? "…"
        : "—";
  const supplyLabel =
    supply.status === "ready"
      ? supply.maxSupply.toString()
      : supply.status === "loading"
        ? "…"
        : "1000";

  const stats = [
    { label: "Minted", value: mintedLabel },
    { label: "Remaining", value: remainingLabel },
    { label: "Supply", value: supplyLabel },
    { label: "Network", value: "Base" },
    { label: "Royalty", value: "5%" },
  ] as const;

  return (
    <section className={ui.dashSection}>
      <div className={ui.sectionHeaderWrap}>
        <p className={ui.sectionHeading}>Collection</p>
        <h2 className={ui.sectionTitle}>Collection Stats</h2>
        <p className={ui.sectionDescription}>
          Live onchain supply data from the Genesis contract on Base Mainnet.
        </p>
      </div>

      <div className="grid grid-cols-2 items-stretch gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
        {stats.map((stat) => (
          <div key={stat.label} className={ui.statCard}>
            <p className={ui.statLabel}>{stat.label}</p>
            <p className={`${ui.statValue} text-xl sm:text-2xl`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {supply.status === "error" ? (
        <p className="mt-3 text-sm text-amber-200/80">
          Unable to refresh live mint count. Showing fallback supply values.
        </p>
      ) : null}
    </section>
  );
}
