"use client";

import { useWalletScoreData } from "@/hooks/useWalletScoreData";
import { formatTokenAmount } from "@/lib/task2earn/display";
import {
  canonicalScoreUrl,
  canonicalTaskUrl,
  farcasterComposeUrl,
  scoreSnapText,
  taskCastText,
} from "@/lib/miniapp/share";
import { Gauge, Share2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useAccount } from "wagmi";

type ShareActionsProps = {
  taskId?: string;
  title: string;
  rewardToken?: string;
  poolAmount?: string;
  durationDays?: number;
  shareCastEnabled?: boolean;
  shareSnapEnabled?: boolean;
  shareCastRewardBqr?: string;
  shareSnapRewardBqr?: string;
  compact?: boolean;
};

/**
 * Outbound Mini App share via sdk.actions.composeCast.
 * @farcaster/miniapp-sdk has no Snap API.
 */
async function openFarcasterComposer(
  text: string,
  embedUrl: string,
): Promise<boolean> {
  try {
    const { sdk } = await import("@farcaster/miniapp-sdk");
    const inMiniApp = await sdk.isInMiniApp();
    if (!inMiniApp) {
      return false;
    }
    if (typeof sdk.actions.composeCast === "function") {
      const embeds: [string] = [embedUrl];
      await sdk.actions.composeCast({
        text,
        embeds,
      });
      return true;
    }
    await sdk.actions.openUrl(farcasterComposeUrl(text, embedUrl));
    return true;
  } catch {
    return false;
  }
}

function openBrowserComposer(text: string, embedUrl: string) {
  window.open(
    farcasterComposeUrl(text, embedUrl),
    "_blank",
    "noopener,noreferrer",
  );
}

async function fetchNeynarScore(address: string): Promise<number | null> {
  try {
    const response = await fetch(
      `/api/wallet-score/social?address=${encodeURIComponent(address)}`,
    );
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as { neynarScore?: number | null };
    return typeof body.neynarScore === "number" ? body.neynarScore : null;
  } catch {
    return null;
  }
}

export default function ShareActions({
  taskId,
  title,
  rewardToken,
  poolAmount,
  durationDays,
  shareCastEnabled = true,
  shareSnapEnabled = true,
  shareCastRewardBqr = "0",
  shareSnapRewardBqr = "0",
  compact = false,
}: ShareActionsProps) {
  const [message, setMessage] = useState<string | null>(null);
  const { address } = useAccount();
  const walletScore = useWalletScoreData();
  const taskUrl = canonicalTaskUrl(taskId);
  const scoreUrl = canonicalScoreUrl();
  const castText = useMemo(() => {
    if (rewardToken && poolAmount && typeof durationDays === "number") {
      return taskCastText({
        title,
        rewardToken,
        poolAmount,
        durationDays,
      });
    }
    return taskCastText(title);
  }, [durationDays, poolAmount, rewardToken, title]);

  const onCast = useCallback(async () => {
    setMessage("Share this Task2Earn campaign — BQR is not awarded yet.");
    const opened = await openFarcasterComposer(castText, taskUrl);
    if (!opened) {
      openBrowserComposer(castText, taskUrl);
    }
  }, [castText, taskUrl]);

  const onSnap = useCallback(async () => {
    const liveWalletScore =
      walletScore.live.isConnected && !walletScore.live.isLoading
        ? walletScore.hero.score
        : null;
    const neynarScore = address ? await fetchNeynarScore(address) : null;
    const snapText = scoreSnapText({
      neynarScore,
      walletScore: liveWalletScore,
    });
    setMessage(
      "Share your scores — Farcaster has no Snap API. Composer only. No BQR awarded.",
    );
    const opened = await openFarcasterComposer(snapText, scoreUrl);
    if (!opened) {
      openBrowserComposer(snapText, scoreUrl);
    }
  }, [
    address,
    scoreUrl,
    walletScore.hero.score,
    walletScore.live.isConnected,
    walletScore.live.isLoading,
  ]);

  return (
    <div className="flex flex-col gap-1.5">
      <div className={`flex ${compact ? "gap-1.5" : "flex-col gap-2 sm:flex-row"}`}>
        {shareCastEnabled ? (
          <button
            type="button"
            title="Share this Task2Earn campaign"
            onClick={() => void onCast()}
            className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full border border-violet-400/40 bg-violet-500/20 px-3 text-[0.7rem] font-semibold uppercase tracking-wide text-violet-100"
          >
            <Share2 className="size-3.5 shrink-0" aria-hidden />
            Share Cast
          </button>
        ) : null}
        {shareSnapEnabled ? (
          <button
            type="button"
            title="Share your social reputation scores"
            onClick={() => void onSnap()}
            className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full border border-teal-400/40 bg-teal-500/20 px-3 text-[0.7rem] font-semibold uppercase tracking-wide text-emerald-100"
          >
            <Gauge className="size-3.5 shrink-0" aria-hidden />
            Share Snap
          </button>
        ) : null}
      </div>
      {!compact && (shareCastEnabled || shareSnapEnabled) ? (
        <p className="text-[0.65rem] text-white/40">
          {shareCastEnabled ? "Share Cast: share this Task2Earn campaign. " : ""}
          {shareSnapEnabled
            ? "Share Snap: share your social reputation scores. "
            : ""}
          {shareCastEnabled
            ? `Cast intent ${formatTokenAmount(shareCastRewardBqr, "BQR")}.`
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
