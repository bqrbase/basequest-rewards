import AchievementProgressBar from "@/components/achievements/AchievementProgressBar";
import GlassPanel from "@/components/GlassPanel";
import type {
  AchievementStatus,
  AchievementViewModel,
} from "@/lib/achievements";
import { ui } from "@/lib/ui-styles";

const statusLabels: Record<AchievementStatus, string> = {
  locked: "Locked",
  in_progress: "In Progress",
  completed: "Completed",
};

const statusBadgeStyles: Record<AchievementStatus, string> = {
  locked: "border-white/10 bg-white/[0.04] text-white/45",
  in_progress:
    "border-cyan-300/40 bg-cyan-500/15 text-cyan-100 shadow-[0_0_10px_rgba(34,211,238,0.25)]",
  completed: "border-emerald-400/35 bg-emerald-500/15 text-emerald-100",
};

type AchievementCardProps = {
  achievement: AchievementViewModel;
};

export default function AchievementCard({ achievement }: AchievementCardProps) {
  const showIncrementalBar =
    achievement.target > 1 || achievement.status === "in_progress";

  return (
    <GlassPanel
      className={`h-full ${ui.dashCardPad} ${
        achievement.status === "locked" ? "opacity-80" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={`flex size-11 shrink-0 items-center justify-center rounded-2xl border text-xl sm:size-12 ${
            achievement.status === "completed"
              ? "border-emerald-400/30 bg-emerald-500/10"
              : achievement.status === "in_progress"
                ? "border-cyan-300/30 bg-cyan-500/10"
                : "border-white/10 bg-white/[0.04] grayscale"
          }`}
          aria-hidden
        >
          {achievement.icon}
        </span>
        <div className="flex flex-col items-end gap-1.5">
          <span
            className={`rounded-full border px-2.5 py-1 text-[0.6rem] font-semibold uppercase tracking-widest sm:text-[0.65rem] ${statusBadgeStyles[achievement.status]}`}
          >
            {statusLabels[achievement.status]}
          </span>
          <span className="rounded-full border border-base-blue/35 bg-gradient-to-r from-base-blue/85 to-indigo-600/85 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-white shadow-[0_0_16px_rgba(0,82,255,0.22)]">
            +{achievement.rewardXp} XP
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-1 flex-col">
        <h3 className="font-sans text-base font-semibold tracking-tight text-white sm:text-lg">
          {achievement.title}
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-white/55">
          {achievement.description}
        </p>

        {showIncrementalBar ? (
          <div className="mt-auto pt-4">
            <div className="mb-1.5 flex items-center justify-between gap-2 text-xs text-white/45">
              <span>Progress</span>
              <span className="tabular-nums">
                {achievement.current}/{achievement.target}
              </span>
            </div>
            <AchievementProgressBar
              percent={achievement.percent}
              label={`${achievement.title} progress`}
            />
          </div>
        ) : achievement.status === "completed" ? (
          <div className="mt-auto pt-4">
            <AchievementProgressBar
              percent={100}
              label={`${achievement.title} completed`}
            />
          </div>
        ) : (
          <div className="mt-auto pt-4">
            <div className="mb-1.5 flex items-center justify-between gap-2 text-xs text-white/35">
              <span>Progress</span>
              <span className="tabular-nums">0/1</span>
            </div>
            <AchievementProgressBar
              percent={0}
              label={`${achievement.title} locked`}
            />
          </div>
        )}
      </div>
    </GlassPanel>
  );
}
