import GlassPanel from "@/components/GlassPanel";
import type { BadgeViewModel } from "@/lib/achievements";
import { ui } from "@/lib/ui-styles";
import Link from "next/link";

type ProfileBadgesProps = {
  badges: BadgeViewModel[];
  achievementTitles: Map<string, string>;
};

export default function ProfileBadges({
  badges,
  achievementTitles,
}: ProfileBadgesProps) {
  const sorted = [...badges].sort((a, b) => {
    if (a.unlocked === b.unlocked) {
      return a.title.localeCompare(b.title);
    }
    return a.unlocked ? -1 : 1;
  });

  return (
    <section className={ui.dashSection}>
      <div className={ui.sectionHeaderWrap}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className={ui.sectionHeading}>Showcase</p>
            <h2 className={ui.sectionTitle}>Badges</h2>
            <p className={ui.sectionDescription}>
              Unlocked badges first, then locked badges with requirements.
            </p>
          </div>
          <Link
            href="/achievements"
            className="text-xs font-semibold text-cyan-200/90 underline-offset-2 hover:underline sm:text-sm"
          >
            All achievements
          </Link>
        </div>
      </div>

      {sorted.length === 0 ? (
        <GlassPanel className={`${ui.dashCardPad} text-center`}>
          <p className="text-sm text-white/45">
            No badges yet. Complete achievements to unlock your first badge.
          </p>
        </GlassPanel>
      ) : (
        <div className="grid grid-cols-2 items-stretch gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4">
          {sorted.map((badge) => {
            const requirementLabels = badge.requires.map(
              (id) => achievementTitles.get(id) ?? id,
            );

            return (
              <GlassPanel
                key={badge.id}
                secondary
                className={`h-full ${ui.dashCardPad} ${
                  badge.unlocked ? "" : "opacity-75"
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
                  <p
                    className={`mt-3 text-[0.65rem] font-semibold uppercase tracking-widest ${
                      badge.unlocked ? "text-emerald-200/90" : "text-white/40"
                    }`}
                  >
                    {badge.unlocked ? "Unlocked" : "Locked"}
                  </p>
                  {!badge.unlocked ? (
                    <p className="mt-auto pt-2 text-[0.65rem] leading-relaxed text-white/35">
                      Requires: {requirementLabels.join(", ")}
                    </p>
                  ) : (
                    <p className="mt-auto pt-2 text-[0.65rem] text-white/35">
                      {badge.requiredCount} milestone
                      {badge.requiredCount === 1 ? "" : "s"}
                    </p>
                  )}
                </div>
              </GlassPanel>
            );
          })}
        </div>
      )}
    </section>
  );
}
