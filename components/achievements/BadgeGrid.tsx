import GlassPanel from "@/components/GlassPanel";
import type { BadgeViewModel } from "@/lib/achievements";
import { ui } from "@/lib/ui-styles";

type BadgeGridProps = {
  badges: BadgeViewModel[];
};

export default function BadgeGrid({ badges }: BadgeGridProps) {
  return (
    <div className="grid grid-cols-2 items-stretch gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4">
      {badges.map((badge) => (
        <GlassPanel
          key={badge.id}
          secondary
          className={`h-full ${ui.dashCardPad} ${
            badge.unlocked ? "" : "opacity-70"
          }`}
        >
          <div className="flex h-full flex-col items-center text-center">
            <span
              className={`flex size-14 items-center justify-center rounded-2xl border text-2xl sm:size-16 sm:text-3xl ${
                badge.unlocked
                  ? "border-cyan-300/35 bg-gradient-to-br from-base-blue/40 via-indigo-600/30 to-violet-700/30 shadow-[0_0_20px_rgba(0,82,255,0.25)]"
                  : "border-white/10 bg-white/[0.03] grayscale"
              }`}
              aria-hidden
            >
              {badge.unlocked ? badge.icon : "🔒"}
            </span>
            <p className="mt-3 font-sans text-sm font-semibold text-white sm:text-base">
              {badge.title}
            </p>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/45">
              {badge.description}
            </p>
            <span
              className={`mt-auto pt-3 text-[0.65rem] font-semibold uppercase tracking-widest ${
                badge.unlocked ? "text-emerald-200/90" : "text-white/35"
              }`}
            >
              {badge.unlocked
                ? "Unlocked"
                : `${badge.unlockedCount}/${badge.requiredCount} locked`}
            </span>
          </div>
        </GlassPanel>
      ))}
    </div>
  );
}
