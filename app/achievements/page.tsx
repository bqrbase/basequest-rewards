import AchievementsPage from "@/components/achievements/AchievementsPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Achievements | BaseQuest Rewards",
  description:
    "Track BaseQuest Rewards achievements, badges, and milestone progress across Base.",
};

export default function AchievementsRoute() {
  return <AchievementsPage />;
}
