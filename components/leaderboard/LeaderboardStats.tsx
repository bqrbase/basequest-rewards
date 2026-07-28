"use client";

import { CountUp } from "@/components/leaderboard/CountUp";
import GlassPanel from "@/components/GlassPanel";
import { ui } from "@/lib/ui-styles";
import { motion, useReducedMotion, type Variants } from "framer-motion";

type LeaderboardStatsProps = {
  totalPlayers: number;
  totalXp: number;
  highestStreak: number;
  activePlayers?: number | null;
};

const container: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06 },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
  },
};

/** Compact stats strip — sits below the table so the podium stays primary. */
export default function LeaderboardStats({
  totalPlayers,
  totalXp,
  highestStreak,
  activePlayers = null,
}: LeaderboardStatsProps) {
  const reduceMotion = useReducedMotion();
  const showActive =
    typeof activePlayers === "number" && Number.isFinite(activePlayers);

  const stats = [
    { key: "players", label: "Total Players", value: totalPlayers, suffix: "" },
    { key: "xp", label: "Total XP", value: totalXp, suffix: "" },
    { key: "streak", label: "Highest Streak", value: highestStreak, suffix: "d" },
    ...(showActive
      ? [
          {
            key: "active",
            label: "Active (24h)",
            value: activePlayers as number,
            suffix: "",
          },
        ]
      : []),
  ];

  return (
    <motion.div
      className={`grid gap-2 sm:gap-3 ${
        stats.length >= 4 ? "grid-cols-2 md:grid-cols-4" : "grid-cols-3"
      }`}
      variants={reduceMotion ? undefined : container}
      initial={reduceMotion ? false : "hidden"}
      animate="show"
      role="list"
      aria-label="Leaderboard statistics"
    >
      {stats.map((stat) => (
        <motion.div
          key={stat.key}
          variants={reduceMotion ? undefined : item}
          role="listitem"
        >
          <GlassPanel
            secondary
            className="min-h-0 p-3 sm:p-3.5"
          >
            <p className={ui.statLabel}>{stat.label}</p>
            <CountUp
              value={stat.value}
              suffix={stat.suffix}
              className="mt-1.5 block font-sans text-lg font-bold tabular-nums tracking-tight text-text-primary sm:text-xl"
              aria-label={`${stat.label}: ${stat.value.toLocaleString()}${stat.suffix}`}
            />
          </GlassPanel>
        </motion.div>
      ))}
    </motion.div>
  );
}
