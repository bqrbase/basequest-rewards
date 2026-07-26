import GlassPanel from "@/components/GlassPanel";
import AnimatedCounter from "@/components/ui/AnimatedCounter";
import type { AchievementSummary } from "@/lib/achievements";
import { ui } from "@/lib/ui-styles";

type AchievementsStatsProps = {
  summary: AchievementSummary;
};

type StatKey = keyof Pick<
  AchievementSummary,
  | "completed"
  | "inProgress"
  | "locked"
  | "earnedXp"
  | "badgesUnlocked"
  | "percent"
>;

const STATS: {
  key: StatKey;
  label: string;
  accent: string;
  format?: (n: number) => string;
}[] = [
  {
    key: "completed",
    label: "Completed",
    accent: "text-emerald-200",
  },
  {
    key: "inProgress",
    label: "In Progress",
    accent: "text-cyan-100",
  },
  {
    key: "locked",
    label: "Locked",
    accent: "text-white/70",
  },
  {
    key: "earnedXp",
    label: "Achievement XP",
    accent: "text-white",
  },
  {
    key: "badgesUnlocked",
    label: "Badges Unlocked",
    accent: "text-amber-100",
  },
  {
    key: "percent",
    label: "Completion Rate",
    accent: "text-cyan-100",
    format: (n) => `${n}%`,
  },
];

export default function AchievementsStats({ summary }: AchievementsStatsProps) {
  return (
    <div className="grid grid-cols-2 items-stretch gap-3 sm:grid-cols-3 sm:gap-4">
      {STATS.map((stat) => (
        <GlassPanel key={stat.key} className={`h-full ${ui.dashCardPad}`}>
          <p className={ui.statLabel}>{stat.label}</p>
          <p
            className={`mt-auto pt-3 font-sans text-2xl font-bold tabular-nums tracking-tight sm:text-3xl ${stat.accent}`}
          >
            <AnimatedCounter
              value={summary[stat.key]}
              format={stat.format ?? ((n) => n.toLocaleString())}
            />
          </p>
        </GlassPanel>
      ))}
    </div>
  );
}
