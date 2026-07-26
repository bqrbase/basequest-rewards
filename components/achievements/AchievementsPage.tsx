"use client";

import AchievementCard from "@/components/achievements/AchievementCard";
import AchievementsHero from "@/components/achievements/AchievementsHero";
import AchievementsStats from "@/components/achievements/AchievementsStats";
import BadgeGrid from "@/components/achievements/BadgeGrid";
import PageShell from "@/components/PageShell";
import {
  ACHIEVEMENT_CATEGORIES,
  deriveAchievements,
  deriveBadges,
  groupAchievementsByCategory,
  summarizeAchievements,
} from "@/lib/achievements";
import { ui } from "@/lib/ui-styles";
import { useQuestEngine } from "@/hooks/useQuestEngine";
import { useMemo } from "react";

function AchievementsSkeleton() {
  return (
    <>
      <section className={`${ui.dashSection} animate-pulse`}>
        <div className={`${ui.glassCard} min-h-[12rem] ${ui.dashCardPad}`}>
          <div className="h-3 w-24 rounded bg-white/10" />
          <div className="mt-3 h-8 w-48 rounded bg-white/10" />
          <div className="mt-6 h-2.5 w-full rounded-full bg-white/10" />
        </div>
      </section>
      <section className={`${ui.dashSection} grid grid-cols-2 gap-3 sm:grid-cols-4`}>
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className={`${ui.glassCard} min-h-[8rem] animate-pulse ${ui.dashCardPad}`}
          />
        ))}
      </section>
      <section className={`${ui.dashSection} ${ui.gridCards}`}>
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className={`${ui.glassCard} min-h-[12rem] animate-pulse ${ui.dashCardPad}`}
          />
        ))}
      </section>
    </>
  );
}

export default function AchievementsPage() {
  const { hydrated, progress, quests } = useQuestEngine();

  const achievements = useMemo(
    () => deriveAchievements(progress, quests),
    [progress, quests],
  );
  const badges = useMemo(
    () => deriveBadges(achievements),
    [achievements],
  );
  const summary = useMemo(
    () => summarizeAchievements(achievements, badges),
    [achievements, badges],
  );
  const byCategory = useMemo(
    () => groupAchievementsByCategory(achievements),
    [achievements],
  );

  return (
    <PageShell>
      {!hydrated ? (
        <AchievementsSkeleton />
      ) : (
        <>
          <section className={ui.dashSection}>
            <AchievementsHero summary={summary} />
          </section>

          <section className={ui.dashSection}>
            <div className={ui.sectionHeaderWrap}>
              <p className={ui.sectionHeading}>Showcase</p>
              <h2 className={ui.sectionTitle}>Badges</h2>
              <p className={ui.sectionDescription}>
                Unlock badges as you complete milestone achievements.
              </p>
            </div>
            <BadgeGrid badges={badges} />
          </section>

          {ACHIEVEMENT_CATEGORIES.map((category) => {
            const items = byCategory.get(category.id) ?? [];
            if (items.length === 0) {
              return null;
            }

            const completedInCategory = items.filter(
              (item) => item.status === "completed",
            ).length;

            return (
              <section key={category.id} className={ui.dashSection}>
                <div className={ui.sectionHeaderWrap}>
                  <p className={ui.sectionHeading}>
                    {completedInCategory}/{items.length} complete
                  </p>
                  <h2 className={ui.sectionTitle}>{category.label}</h2>
                  <p className={ui.sectionDescription}>
                    {category.description}
                  </p>
                </div>
                <div className={ui.gridCards}>
                  {items.map((achievement) => (
                    <AchievementCard
                      key={achievement.id}
                      achievement={achievement}
                    />
                  ))}
                </div>
              </section>
            );
          })}

          <section className={ui.dashSection}>
            <div className={ui.sectionHeaderWrap}>
              <p className={ui.sectionHeading}>Overview</p>
              <h2 className={ui.sectionTitle}>Statistics</h2>
              <p className={ui.sectionDescription}>
                A snapshot of your achievement progress across BaseQuest.
              </p>
            </div>
            <AchievementsStats summary={summary} />
          </section>
        </>
      )}
    </PageShell>
  );
}
