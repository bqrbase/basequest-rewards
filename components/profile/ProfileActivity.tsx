import ProfileStatCard from "@/components/profile/ProfileStatCard";
import GlassPanel from "@/components/GlassPanel";
import type { ProfileActivityMetrics } from "@/lib/profile/activityMetrics";
import type { ActivityItem } from "@/lib/wallet-score/mock-data";
import type { QuestViewModel } from "@/lib/quest-engine";
import { ui } from "@/lib/ui-styles";

type ProfileActivityProps = {
  metrics: ProfileActivityMetrics;
  metricsLoading: boolean;
  recentOnchain: ActivityItem[];
  quests: QuestViewModel[];
};

type TimelineItem = {
  id: string;
  title: string;
  meta: string;
  tone: "completed" | "available" | "onchain";
};

function buildTimeline(
  recentOnchain: ActivityItem[],
  quests: QuestViewModel[],
): TimelineItem[] {
  const onchain = recentOnchain.slice(0, 4).map((item) => ({
    id: `tx-${item.id}`,
    title: item.type,
    meta: `${item.description} · ${item.time}`,
    tone: "onchain" as const,
  }));

  const completed = quests
    .filter((quest) => quest.status === "completed")
    .slice(0, 4)
    .map((quest) => ({
      id: `quest-${quest.id}`,
      title: quest.title,
      meta: `Completed · ${quest.reward}`,
      tone: "completed" as const,
    }));

  const available = quests
    .filter((quest) => quest.status === "available")
    .slice(0, 2)
    .map((quest) => ({
      id: `ready-${quest.id}`,
      title: quest.title,
      meta: `Ready · ${quest.reward}`,
      tone: "available" as const,
    }));

  return [...onchain, ...completed, ...available].slice(0, 8);
}

export default function ProfileActivity({
  metrics,
  metricsLoading,
  recentOnchain,
  quests,
}: ProfileActivityProps) {
  const timeline = buildTimeline(recentOnchain, quests);

  const cards = [
    {
      label: "Total Swaps",
      value: metricsLoading ? null : metrics.totalSwaps,
      hint: "DEX / router interactions",
    },
    {
      label: "Total Bridges",
      value: metricsLoading ? null : metrics.totalBridges,
      hint: "Bridge protocol touches",
    },
    {
      label: "Protocols Used",
      value: metricsLoading ? null : metrics.protocolsUsed,
      hint: "Known Base protocols",
    },
    {
      label: "NFTs Owned",
      value: metricsLoading ? null : metrics.nftsOwned,
      hint: "On Base",
    },
    {
      label: "DeFi Activity",
      value: metricsLoading ? null : metrics.defiActivity,
      hint: "Protocol interactions",
    },
  ];

  return (
    <section className={ui.dashSection}>
      <div className={ui.sectionHeaderWrap}>
        <p className={ui.sectionHeading}>Activity</p>
        <h2 className={ui.sectionTitle}>Onchain Snapshot</h2>
        <p className={ui.sectionDescription}>
          Swaps, bridges, and ecosystem activity derived from your wallet data.
        </p>
      </div>

      <div className="grid grid-cols-2 items-stretch gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
        {cards.map((card) => (
          <ProfileStatCard
            key={card.label}
            label={card.label}
            value={metricsLoading ? null : card.value}
            hint={
              metricsLoading
                ? "Loading…"
                : card.value === null
                  ? "Unavailable"
                  : card.hint
            }
          />
        ))}
      </div>

      <div className="mt-4 sm:mt-5">
        <GlassPanel className={ui.dashCardPad}>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className={ui.statLabel}>Timeline</p>
              <h3 className="mt-1 font-sans text-lg font-semibold text-white">
                Recent activity
              </h3>
            </div>
          </div>

          <ul className="mt-4 space-y-2 sm:mt-5">
            {timeline.length === 0 ? (
              <li className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-6 text-center text-sm text-white/45">
                No recent activity yet. Complete a quest or onchain action to
                fill your timeline.
              </li>
            ) : (
              timeline.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5"
                >
                  <span
                    className={`mt-1 size-2.5 shrink-0 rounded-full ${
                      item.tone === "completed"
                        ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.45)]"
                        : item.tone === "available"
                          ? "bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.35)]"
                          : "bg-indigo-300 shadow-[0_0_10px_rgba(129,140,248,0.4)]"
                    }`}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">
                      {item.title}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-white/40">
                      {item.meta}
                    </p>
                  </div>
                </li>
              ))
            )}
          </ul>
        </GlassPanel>
      </div>
    </section>
  );
}
