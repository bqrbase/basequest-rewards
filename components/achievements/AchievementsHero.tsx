import AchievementProgressBar from "@/components/achievements/AchievementProgressBar";
import GlassPanel from "@/components/GlassPanel";
import AnimatedCounter from "@/components/ui/AnimatedCounter";
import type { AchievementSummary } from "@/lib/achievements";
import { ui } from "@/lib/ui-styles";

type AchievementsHeroProps = {
  summary: AchievementSummary;
};

export default function AchievementsHero({ summary }: AchievementsHeroProps) {
  return (
    <GlassPanel className={ui.dashCardPad}>
      <div className="grid grid-cols-1 gap-5 sm:gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:items-end">
        <div>
          <p className={ui.sectionHeading}>Collection</p>
          <h1 className={ui.pageTitle}>Achievements</h1>
          <p className={ui.pageSubtitle}>
            Track milestones across BaseQuest — swaps, bridges, builds, and
            community wins.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-2.5 py-3 text-center sm:px-3">
            <p className={ui.statLabel}>Total</p>
            <p className="mt-1.5 font-sans text-xl font-bold tabular-nums text-white sm:text-2xl">
              <AnimatedCounter value={summary.total} />
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-2.5 py-3 text-center sm:px-3">
            <p className={ui.statLabel}>Done</p>
            <p className="mt-1.5 font-sans text-xl font-bold tabular-nums text-emerald-200 sm:text-2xl">
              <AnimatedCounter value={summary.completed} />
            </p>
          </div>
          <div className="rounded-xl border border-cyan-300/20 bg-cyan-500/10 px-2.5 py-3 text-center sm:px-3">
            <p className={ui.statLabel}>Complete</p>
            <p className="mt-1.5 font-sans text-xl font-bold tabular-nums text-cyan-100 sm:text-2xl">
              <AnimatedCounter
                value={summary.percent}
                format={(n) => `${n}%`}
              />
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 sm:mt-6">
        <div className="mb-2 flex items-center justify-between gap-2 text-xs text-white/45 sm:text-sm">
          <span>Overall progress</span>
          <span className="tabular-nums">
            {summary.completed}/{summary.total}
          </span>
        </div>
        <AchievementProgressBar
          percent={summary.percent}
          size="md"
          label="Overall achievements progress"
        />
      </div>
    </GlassPanel>
  );
}
