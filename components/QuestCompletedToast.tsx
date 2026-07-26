"use client";

import GlassPanel from "@/components/GlassPanel";
import { useEffect } from "react";

export type QuestCompletedToastData = {
  title: string;
  rewardXp: number;
};

type QuestCompletedToastProps = {
  toast: QuestCompletedToastData | null;
  onDismiss: () => void;
};

/**
 * Lightweight success toast for one-time quest completions.
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

  return (
    <div className="pointer-events-none fixed inset-x-0 top-20 z-50 flex justify-center px-4 sm:top-24">
      <GlassPanel
        role="status"
        aria-live="polite"
        className="pointer-events-auto w-full max-w-sm border-emerald-400/30 p-4 text-center shadow-[0_0_28px_rgba(16,185,129,0.22)] sm:p-5"
      >
        <p className="font-sans text-lg font-bold text-white sm:text-xl">
          🎉 Quest Completed
        </p>
        <p className="mt-1.5 text-sm text-white/70 sm:text-base">{toast.title}</p>
        <p className="mt-2 font-mono text-sm font-semibold tabular-nums text-emerald-200">
          +{toast.rewardXp} XP
        </p>
      </GlassPanel>
    </div>
  );
}
