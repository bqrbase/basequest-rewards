"use client";

import GenesisBadge from "@/components/genesis/GenesisBadge";
import ProfileAvatar from "@/components/profile/ProfileAvatar";
import GlassPanel from "@/components/GlassPanel";
import AnimatedCounter from "@/components/ui/AnimatedCounter";
import ScoreRing from "@/components/ui/ScoreRing";
import { formatWalletAddress, ui } from "@/lib/ui-styles";
import Link from "next/link";
import { useState } from "react";
import type { Address } from "viem";

type ProfileHeroProps = {
  address: string;
  basename: string | null;
  level: number;
  totalXp: number;
  walletScore: number | null;
  walletScoreMax: number;
  memberSince: string | null;
  rank: number | null;
};

export default function ProfileHero({
  address,
  basename,
  level,
  totalXp,
  walletScore,
  walletScoreMax,
  memberSince,
  rank,
}: ProfileHeroProps) {
  const [copied, setCopied] = useState(false);
  const scorePercent =
    walletScore !== null && walletScoreMax > 0
      ? Math.round((walletScore / walletScoreMax) * 100)
      : 0;

  async function handleCopyAddress() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <GlassPanel className={ui.dashCardPad}>
      <div className="grid grid-cols-1 items-center gap-5 md:grid-cols-[auto_minmax(0,1fr)_auto] md:gap-6">
        <div className="mx-auto md:mx-0">
          <ProfileAvatar address={address} />
        </div>

        <div className="min-w-0 text-center md:text-left">
          <p className={ui.sectionHeading}>Profile</p>
          {basename ? (
            <p className="mt-1 truncate font-sans text-xl font-bold tracking-tight text-white sm:text-2xl">
              {basename}
            </p>
          ) : (
            <p className="mt-1 font-sans text-xl font-bold tracking-tight text-white sm:text-2xl">
              Base Builder
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center justify-center gap-2 md:justify-start">
            <GenesisBadge address={address as Address} />
            <p
              className="truncate font-mono text-sm tracking-wide text-white/60"
              title={address}
            >
              {formatWalletAddress(address)}
            </p>
            <button
              type="button"
              onClick={() => void handleCopyAddress()}
              aria-live="polite"
              className={`rounded-badge border px-2.5 py-1 text-[0.6rem] font-semibold uppercase tracking-widest transition-all ${
                copied
                  ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-100"
                  : "border-white/12 bg-white/[0.04] text-white/70 hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
              }`}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-white/45 md:justify-start">
            {memberSince ? <span>Member since {memberSince}</span> : null}
            {rank ? (
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5">
                Rank #{rank}
              </span>
            ) : null}
            {!basename ? (
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5">
                No ENS / Base Name
              </span>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3 md:grid-cols-1 md:min-w-[9.5rem]">
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-2.5 py-3 text-center">
            <p className={ui.statLabel}>Level</p>
            <p className="mt-1 font-sans text-lg font-bold tabular-nums text-white sm:text-xl">
              <AnimatedCounter value={level} />
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-2.5 py-3 text-center">
            <p className={ui.statLabel}>Total XP</p>
            <p className="mt-1 font-sans text-lg font-bold tabular-nums text-cyan-100 sm:text-xl">
              <AnimatedCounter value={totalXp} />
            </p>
          </div>
          <Link
            href="/base-wallet-score"
            className="flex flex-col items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-500/10 px-2.5 py-3 text-center transition-colors hover:bg-cyan-500/15"
          >
            <p className={ui.statLabel}>Wallet Score</p>
            {walletScore !== null ? (
              <div className="mt-1 flex items-center justify-center">
                <ScoreRing
                  value={scorePercent}
                  size={56}
                  strokeWidth={5}
                  label="Wallet Score"
                  center={
                    <span className="font-sans text-xs font-bold tabular-nums text-white">
                      {walletScore}
                    </span>
                  }
                />
              </div>
            ) : (
              <p className="mt-1 font-sans text-lg font-bold text-white/40">—</p>
            )}
          </Link>
        </div>
      </div>
    </GlassPanel>
  );
}
