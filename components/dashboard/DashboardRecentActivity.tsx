"use client";

import GlassPanel from "@/components/GlassPanel";
import type { QuestViewModel } from "@/lib/quest-engine";
import { ui } from "@/lib/ui-styles";

type DashboardRecentActivityProps = {
  quests: QuestViewModel[];
};

/**
 * Presentation-only activity list derived from existing quest statuses.
 */
export default function DashboardRecentActivity({
  quests,
}: DashboardRecentActivityProps) {
  const completed = quests.filter((quest) => quest.status === "completed");
  const available = quests.filter((quest) => quest.status === "available");

  const items = [
    ...completed.slice(0, 4).map((quest) => ({
      id: quest.id,
      title: quest.title,
      meta: `Completed · ${quest.reward}`,
      tone: "completed" as const,
    })),
    ...available.slice(0, 2).map((quest) => ({
      id: quest.id,
      title: quest.title,
      meta: `Ready · ${quest.reward}`,
      tone: "available" as const,
    })),
  ].slice(0, 6);

  return (
    <GlassPanel className={`h-full ${ui.dashCardPad}`}>
      <div>
        <p className={ui.statLabel}>Timeline</p>
        <h3 className="mt-1 font-sans text-lg font-semibold text-white sm:text-xl">
          Recent activity
        </h3>
        <p className="mt-1 text-xs text-white/40 sm:text-sm">
          Based on your current quest progress
        </p>
      </div>

      <ul className="mt-4 flex flex-1 flex-col space-y-2 sm:mt-5">
        {items.length === 0 ? (
          <li className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-4 text-center text-sm text-white/45">
            Complete your first quest to start the timeline.
          </li>
        ) : (
          items.map((item) => (
            <li
              key={`${item.tone}-${item.id}`}
              className="flex items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5"
            >
              <span
                className={`mt-1 size-2.5 shrink-0 rounded-full ${
                  item.tone === "completed"
                    ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.45)]"
                    : "bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.35)]"
                }`}
                aria-hidden
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">
                  {item.title}
                </p>
                <p className="mt-0.5 text-xs text-white/40">{item.meta}</p>
              </div>
            </li>
          ))
        )}
      </ul>
    </GlassPanel>
  );
}
