import ProfileStatCard from "@/components/profile/ProfileStatCard";
import LevelProgressBar from "@/components/LevelProgressBar";
import GlassPanel from "@/components/GlassPanel";
import { ui } from "@/lib/ui-styles";

type ProfileProgressProps = {
  totalXp: number;
  streak: number;
  completedQuests: number;
  completedAchievements: number;
  totalAchievements: number;
};

export default function ProfileProgress({
  totalXp,
  streak,
  completedQuests,
  completedAchievements,
  totalAchievements,
}: ProfileProgressProps) {
  return (
    <section className={ui.dashSection}>
      <div className={ui.sectionHeaderWrap}>
        <p className={ui.sectionHeading}>Progress</p>
        <h2 className={ui.sectionTitle}>Your Journey</h2>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-3 sm:gap-4 md:grid-cols-2">
        <GlassPanel className={`h-full ${ui.dashCardPad}`}>
          <p className={ui.statLabel}>XP Progress</p>
          <p className="mt-1 font-sans text-lg font-semibold text-white">
            Next level path
          </p>
          <div className="mt-4">
            <LevelProgressBar totalXp={totalXp} showDetails />
          </div>
        </GlassPanel>

        <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-3 sm:gap-3">
          <ProfileStatCard
            label="Current Streak"
            value={streak}
            format={(n) => `${n}`}
            hint="days"
            accentClassName="text-amber-100"
          />
          <ProfileStatCard
            label="Completed Quests"
            value={completedQuests}
            accentClassName="text-emerald-200"
          />
          <ProfileStatCard
            label="Achievements"
            value={completedAchievements}
            hint={`${completedAchievements}/${totalAchievements} unlocked`}
            accentClassName="text-cyan-100"
          />
        </div>
      </div>
    </section>
  );
}
