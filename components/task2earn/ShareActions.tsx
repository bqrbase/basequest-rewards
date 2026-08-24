"use client";

import { formatTokenAmount } from "@/lib/task2earn/display";
import { useCallback, useState } from "react";

type ShareActionsProps = {
  taskId?: string;
  title: string;
  shareCastEnabled?: boolean;
  shareSnapEnabled?: boolean;
  shareCastRewardBqr?: string;
  shareSnapRewardBqr?: string;
  compact?: boolean;
};

async function openCastComposer(text: string, embedUrl: string) {
  try {
    const { sdk } = await import("@farcaster/miniapp-sdk");
    const inMiniApp = await sdk.isInMiniApp();
    const actions = sdk.actions as {
      composeCast?: (input: { text: string; embeds?: string[] }) => Promise<unknown>;
      openUrl: (url: string) => Promise<void>;
    };
    if (inMiniApp && typeof actions.composeCast === "function") {
      await actions.composeCast({ text, embeds: [embedUrl] });
      return;
    }
    if (inMiniApp) {
      await actions.openUrl(
        `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=${encodeURIComponent(embedUrl)}`,
      );
      return;
    }
  } catch {
    // Fall through to browser compose URL.
  }
  window.open(
    `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}`,
    "_blank",
    "noopener,noreferrer",
  );
}

export default function ShareActions({
  taskId,
  title,
  shareCastEnabled = true,
  shareSnapEnabled = true,
  shareCastRewardBqr = "0",
  shareSnapRewardBqr = "0",
  compact = false,
}: ShareActionsProps) {
  const [message, setMessage] = useState<string | null>(null);
  const origin =
    typeof window === "undefined" ? "https://basequest.online" : window.location.origin;
  const taskUrl = taskId ? `${origin}/tasks/${taskId}` : `${origin}/tasks`;
  const castText = `Join this Task2Earn: ${title}`;

  const onCast = useCallback(async () => {
    setMessage("Opening composer — BQR share rewards are not awarded yet.");
    await openCastComposer(castText, taskUrl);
  }, [castText, taskUrl]);

  const onSnap = useCallback(async () => {
    setMessage("Share Snap is UI-only — no BQR is awarded yet.");
    try {
      if (navigator.share) {
        await navigator.share({ title, url: taskUrl, text: castText });
        return;
      }
    } catch {
      // User cancelled or share failed; copy instead.
    }
    try {
      await navigator.clipboard.writeText(taskUrl);
      setMessage("Task link copied. Snap rewards are not awarded yet.");
    } catch {
      setMessage("Copy the task link to share. No BQR awarded yet.");
    }
  }, [castText, taskUrl, title]);

  return (
    <div className="flex flex-col gap-1.5">
      <div className={`flex ${compact ? "gap-1.5" : "flex-col gap-2 sm:flex-row"}`}>
        {shareCastEnabled ? (
          <button
            type="button"
            onClick={() => void onCast()}
            className="inline-flex min-h-10 flex-1 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-500/15 px-3 text-[0.7rem] font-semibold uppercase tracking-wide text-cyan-100"
          >
            Share Cast
          </button>
        ) : null}
        {shareSnapEnabled ? (
          <button
            type="button"
            onClick={() => void onSnap()}
            className="inline-flex min-h-10 flex-1 items-center justify-center rounded-full border border-fuchsia-400/30 bg-fuchsia-500/15 px-3 text-[0.7rem] font-semibold uppercase tracking-wide text-fuchsia-100"
          >
            Share Snap
          </button>
        ) : null}
      </div>
      {!compact && (shareCastEnabled || shareSnapEnabled) ? (
        <p className="text-[0.65rem] text-white/40">
          Share actions only.
          {shareCastEnabled
            ? ` Cast intent ${formatTokenAmount(shareCastRewardBqr, "BQR")}.`
            : ""}
          {shareSnapEnabled
            ? ` Snap intent ${formatTokenAmount(shareSnapRewardBqr, "BQR")}.`
            : ""}{" "}
          Not transferred.
        </p>
      ) : null}
      {message ? (
        <p className="text-[0.65rem] text-white/55" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
