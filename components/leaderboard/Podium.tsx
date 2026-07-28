"use client";

import { CountUp } from "@/components/leaderboard/CountUp";
import { WalletAvatar } from "@/components/leaderboard/WalletAvatar";
import { normalizeWalletAddress } from "@/components/leaderboard/utils";
import type { LeaderboardEntry } from "@/lib/supabase/leaderboard";
import { formatWalletAddress } from "@/lib/ui-styles";
import { motion, useReducedMotion } from "framer-motion";
import { Award, Crown, Flame, Medal, Sparkles } from "lucide-react";

type PodiumProps = {
  entries: LeaderboardEntry[];
  normalizedWalletAddress: string | null;
};

type Theme = {
  order: string;
  scale: string;
  height: string;
  padding: string;
  border: string;
  shadow: string;
  glowClass: string;
  glowAnimate: boolean;
  surface: string;
  rankText: string;
  bar: string;
};

const THEMES: Theme[] = [
  {
    // 1st — gold, center, ~18% larger
    order: "order-2",
    scale: "z-20 scale-100 sm:scale-[1.18] sm:-translate-y-4",
    height: "min-h-[13.5rem] sm:min-h-[16.5rem]",
    padding: "p-4 pt-8 sm:p-5 sm:pt-10",
    border: "border-2 border-amber-300/70",
    shadow:
      "shadow-[0_20px_60px_rgba(0,0,0,0.45),0_0_48px_rgba(251,191,36,0.35)]",
    glowClass: "bg-amber-400/40",
    glowAnimate: true,
    surface:
      "bg-gradient-to-b from-amber-400/25 via-[#1a1630]/85 to-[#0c142e]/90",
    rankText: "text-amber-200",
    bar: "from-amber-300 via-amber-400 to-amber-600/40",
  },
  {
    // 2nd — silver
    order: "order-1",
    scale: "z-10",
    height: "min-h-[11.5rem] sm:min-h-[13.75rem]",
    padding: "p-3 pt-6 sm:p-4 sm:pt-7",
    border: "border-2 border-slate-200/55",
    shadow:
      "shadow-[0_16px_40px_rgba(0,0,0,0.4),0_0_28px_rgba(226,232,240,0.18)]",
    glowClass: "bg-slate-100/25",
    glowAnimate: false,
    surface:
      "bg-gradient-to-b from-slate-200/18 via-[#161c34]/88 to-[#0c142e]/90",
    rankText: "text-slate-100",
    bar: "from-slate-100 via-slate-300 to-slate-500/30",
  },
  {
    // 3rd — bronze
    order: "order-3",
    scale: "z-10",
    height: "min-h-[10.75rem] sm:min-h-[12.75rem]",
    padding: "p-3 pt-6 sm:p-4 sm:pt-7",
    border: "border-2 border-orange-400/55",
    shadow:
      "shadow-[0_16px_40px_rgba(0,0,0,0.4),0_0_28px_rgba(251,146,60,0.22)]",
    glowClass: "bg-orange-400/30",
    glowAnimate: false,
    surface:
      "bg-gradient-to-b from-orange-500/20 via-[#1a152c]/88 to-[#0c142e]/90",
    rankText: "text-orange-200",
    bar: "from-orange-300 via-orange-500 to-amber-800/40",
  },
];

function getPodiumOrder(length: number) {
  if (length >= 3) {
    return [1, 0, 2];
  }
  if (length === 2) {
    return [1, 0];
  }
  return [0];
}

function WinnerParticles({ enabled }: { enabled: boolean }) {
  if (!enabled) {
    return null;
  }

  const dots = [
    { x: "12%", y: "18%", delay: 0, size: 3 },
    { x: "82%", y: "22%", delay: 0.4, size: 2.5 },
    { x: "20%", y: "72%", delay: 0.8, size: 2 },
    { x: "78%", y: "68%", delay: 1.1, size: 3 },
    { x: "50%", y: "12%", delay: 0.2, size: 2 },
    { x: "8%", y: "48%", delay: 1.4, size: 2.5 },
    { x: "90%", y: "46%", delay: 0.6, size: 2 },
    { x: "36%", y: "84%", delay: 1.7, size: 2 },
  ];

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {dots.map((dot, index) => (
        <motion.span
          key={index}
          className="absolute rounded-full bg-amber-200"
          style={{
            left: dot.x,
            top: dot.y,
            width: dot.size,
            height: dot.size,
            boxShadow: "0 0 8px rgba(251,191,36,0.8)",
          }}
          animate={{
            y: [0, -10, 0],
            opacity: [0.15, 0.95, 0.15],
            scale: [0.8, 1.25, 0.8],
          }}
          transition={{
            duration: 2.4 + index * 0.12,
            repeat: Infinity,
            delay: dot.delay,
            ease: "easeInOut",
          }}
        />
      ))}
      <motion.div
        className="absolute left-3 top-10 text-amber-200/70"
        animate={{ y: [0, -6, 0], rotate: [0, 12, 0], opacity: [0.35, 0.9, 0.35] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      >
        <Sparkles className="size-3.5" />
      </motion.div>
      <motion.div
        className="absolute right-3 top-14 text-amber-100/60"
        animate={{ y: [0, -8, 0], rotate: [0, -10, 0], opacity: [0.25, 0.85, 0.25] }}
        transition={{
          duration: 2.8,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.5,
        }}
      >
        <Sparkles className="size-3" />
      </motion.div>
    </div>
  );
}

function RankMedal({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="inline-flex size-8 items-center justify-center rounded-full border border-amber-300/50 bg-amber-400/20 text-amber-200 shadow-[0_0_18px_rgba(251,191,36,0.35)] sm:size-9">
        <Medal className="size-4 sm:size-5" aria-hidden />
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="inline-flex size-7 items-center justify-center rounded-full border border-slate-200/45 bg-slate-200/15 text-slate-100 sm:size-8">
        <Award className="size-3.5 sm:size-4" aria-hidden />
      </span>
    );
  }
  return (
    <span className="inline-flex size-7 items-center justify-center rounded-full border border-orange-400/45 bg-orange-500/15 text-orange-200 sm:size-8">
      <Award className="size-3.5 sm:size-4" aria-hidden />
    </span>
  );
}

export default function Podium({
  entries,
  normalizedWalletAddress,
}: PodiumProps) {
  const reduceMotion = useReducedMotion();
  const topThree = entries.slice(0, 3);
  const podiumOrder = getPodiumOrder(topThree.length);

  if (topThree.length === 0) {
    return null;
  }

  return (
    <motion.section
      className="relative w-full pt-2 sm:pt-3"
      aria-label="Top three podium"
      initial={reduceMotion ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="mb-4 flex items-end justify-between gap-3 sm:mb-5">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-amber-200/55">
            Live competition
          </p>
          <h1
            id="leaderboard-heading"
            className="mt-1 font-sans text-2xl font-bold tracking-tight text-white sm:text-3xl"
          >
            Top Contenders
          </h1>
        </div>
        <Sparkles
          className="size-5 shrink-0 text-base-blue/80 sm:size-6"
          aria-hidden
        />
      </div>

      <div
        className={`grid items-end gap-2.5 px-1 sm:gap-5 sm:px-3 ${
          topThree.length === 1
            ? "mx-auto max-w-[16rem] grid-cols-1"
            : topThree.length === 2
              ? "mx-auto max-w-xl grid-cols-2"
              : "mx-auto max-w-3xl grid-cols-3"
        }`}
      >
        {podiumOrder.map((entryIndex, visualIndex) => {
          const entry = topThree[entryIndex];
          const rank = entryIndex + 1;
          const theme = THEMES[entryIndex];
          const isCurrentUser =
            normalizedWalletAddress !== null &&
            normalizeWalletAddress(entry.wallet_address) ===
              normalizedWalletAddress;
          const isWinner = rank === 1;

          return (
            <motion.article
              key={entry.wallet_address}
              className={`group relative flex flex-col items-center overflow-visible rounded-[1.35rem] border backdrop-blur-xl transition-transform duration-300 hover:-translate-y-1.5 focus-within:-translate-y-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300/60 ${theme.order} ${theme.scale} ${theme.height} ${theme.padding} ${theme.border} ${theme.shadow} ${theme.surface}`}
              initial={reduceMotion ? false : { opacity: 0, y: 28, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                duration: 0.5,
                delay: reduceMotion ? 0 : 0.1 * visualIndex,
                ease: [0.22, 1, 0.36, 1],
              }}
              tabIndex={0}
              aria-label={`Rank ${rank}: ${formatWalletAddress(entry.wallet_address)}, ${entry.total_xp} XP, ${entry.streak} day streak`}
            >
              {/* Animated medal glow */}
              <motion.div
                aria-hidden
                className={`pointer-events-none absolute -top-8 left-1/2 size-28 -translate-x-1/2 rounded-full blur-3xl sm:size-36 ${theme.glowClass}`}
                animate={
                  theme.glowAnimate && !reduceMotion
                    ? {
                        opacity: [0.35, 0.85, 0.35],
                        scale: [0.9, 1.15, 0.9],
                      }
                    : undefined
                }
                transition={
                  theme.glowAnimate
                    ? { duration: 2.8, repeat: Infinity, ease: "easeInOut" }
                    : undefined
                }
              />

              <WinnerParticles enabled={isWinner && !reduceMotion} />

              {/* Floating crown above avatar (1st only) */}
              {isWinner ? (
                <motion.div
                  className="absolute -top-3 left-1/2 z-30 -translate-x-1/2 text-amber-300 drop-shadow-[0_0_14px_rgba(251,191,36,0.75)] sm:-top-4"
                  aria-hidden
                  animate={
                    reduceMotion
                      ? undefined
                      : { y: [0, -7, 0], rotate: [-6, 6, -6] }
                  }
                  transition={{
                    duration: 2.6,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  <Crown className="size-7 fill-amber-300/30 sm:size-8" />
                </motion.div>
              ) : null}

              <div className="relative z-10 flex flex-col items-center">
                <RankMedal rank={rank} />

                <div className="relative mt-2.5 sm:mt-3">
                  {isWinner ? (
                    <motion.div
                      aria-hidden
                      className="pointer-events-none absolute -inset-2 rounded-full border border-amber-300/40"
                      animate={
                        reduceMotion
                          ? undefined
                          : { opacity: [0.3, 0.9, 0.3], scale: [1, 1.06, 1] }
                      }
                      transition={{
                        duration: 2.2,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    />
                  ) : null}
                  <WalletAvatar
                    address={entry.wallet_address}
                    size={isWinner ? "lg" : "md"}
                    className={`relative ring-2 ${
                      isWinner
                        ? "ring-amber-300/50"
                        : rank === 2
                          ? "ring-slate-200/35"
                          : "ring-orange-400/35"
                    }`}
                  />
                </div>

                <p
                  className={`mt-2.5 font-sans text-xl font-bold sm:mt-3 sm:text-3xl ${theme.rankText}`}
                >
                  #{rank}
                </p>

                <p
                  className="mt-1 w-full max-w-full truncate px-1 text-center font-mono text-[0.65rem] tracking-wide text-white sm:text-xs"
                  title={entry.wallet_address}
                >
                  {formatWalletAddress(entry.wallet_address)}
                </p>

                {isCurrentUser ? (
                  <span className="mt-2 inline-flex rounded-badge border border-base-blue/50 bg-base-blue/20 px-2 py-0.5 text-[0.55rem] font-bold uppercase tracking-widest text-cyan-100">
                    You
                  </span>
                ) : null}
              </div>

              <div className="relative z-10 mt-auto w-full pt-3 sm:pt-4">
                <div
                  aria-hidden
                  className={`mb-3 h-1.5 w-full rounded-full bg-gradient-to-r ${theme.bar}`}
                />
                <div className="flex items-center justify-between gap-2 text-[0.7rem] sm:text-xs">
                  <CountUp
                    value={entry.total_xp}
                    suffix=" XP"
                    className="font-semibold tabular-nums text-white"
                  />
                  <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-white/70">
                    <Flame className="size-3.5 text-orange-300" aria-hidden />
                    {entry.streak}d
                  </span>
                </div>
              </div>
            </motion.article>
          );
        })}
      </div>
    </motion.section>
  );
}
