"use client";

import GenesisXPRewardDisplay from "@/components/genesis/GenesisXPRewardDisplay";
import GlassPanel from "@/components/GlassPanel";
import { useEffect } from "react";

export type QuestCompletedToastData = {
  title: string;
  rewardXp: number;
  /** Leading emoji in the toast headline. Defaults to celebration. */
  emoji?: string;
};

type QuestCompletedToastProps = {
  toast: QuestCompletedToastData | null;
  onDismiss: () => void;
};

/**
 * Lightweight success toast for one-time quest completions.
 * Shows Genesis bonus breakdown when access allows (display only).
 */
export default function QuestCompletedToast({
  toast,
  onDismiss,
}: QuestCompletedToastProps) {
  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(onDismiss, 4500);
    return () => window.clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) {
    return null;
  }

  const emoji = toast.emoji ?? "🎉";

  return (
    <div className="pointer-events-none fixed inset-x-0 top-20 z-50 flex justify-center px-4 sm:top-24">
      <GlassPanel
        role="status"
        aria-live="polite"
        className="pointer-events-auto w-full max-w-sm border-emerald-400/30 p-4 text-center shadow-[0_0_28px_rgba(16,185,129,0.22)] sm:p-5"
      >
        <p className="font-sans text-lg font-bold text-white sm:text-xl">
          {emoji} Quest Completed
        </p>
        <p className="mt-1.5 text-sm text-white/70 sm:text-base">{toast.title}</p>
        <div className="mt-3 flex justify-center">
          <GenesisXPRewardDisplay
            baseXP={toast.rewardXp}
            rewardLabel={`+${toast.rewardXp} XP`}
            variant="stacked"
            className="w-full text-left"
          />
        </div>
      </GlassPanel>
    </div>
  );
}
