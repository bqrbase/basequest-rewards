"use client";

import { useWalletScoreData } from "@/hooks/useWalletScoreData";
import {
  fetchTask2EarnRewards,
  requestShareCastReward,
} from "@/lib/task2earn/client";
import {
  SHARE_CAST_REWARD_BQR,
  T2E_EARNED_BQR_LABEL,
} from "@/lib/task2earn/constants";
import { formatTokenAmount } from "@/lib/task2earn/display";
import {
  canonicalScoreUrl,
  canonicalTaskUrl,
  farcasterComposeUrl,
  scoreSnapText,
  taskCastText,
} from "@/lib/miniapp/share";
import { Gauge, Share2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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

type ShareCastComposeResult = {
  openedInMiniApp: boolean;
  hash: string | null;
};

async function openShareCastComposer(
  text: string,
  embedUrl: string,
): Promise<ShareCastComposeResult> {
  try {
    const { sdk } = await import("@farcaster/miniapp-sdk");
    const inMiniApp = await sdk.isInMiniApp();
    if (!inMiniApp) {
      return { openedInMiniApp: false, hash: null };
    }
    if (typeof sdk.actions.composeCast === "function") {
      const embeds: [string] = [embedUrl];
      const result = (await sdk.actions.composeCast({
        text,
        embeds,
      })) as { cast?: { hash?: string } | null } | undefined;
      const hash =
        typeof result?.cast?.hash === "string" && result.cast.hash.trim()
          ? result.cast.hash.trim()
          : null;
      return { openedInMiniApp: true, hash };
    }
    await sdk.actions.openUrl(farcasterComposeUrl(text, embedUrl));
    return { openedInMiniApp: true, hash: null };
  } catch {
    return { openedInMiniApp: false, hash: null };
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

function shareRewardMessage(error: string): string {
  switch (error) {
    case "creator_ineligible":
      return "Creators cannot earn BQR for sharing their own task.";
    case "share_cast_disabled":
      return "Share Cast rewards are not enabled for this task.";
    case "task_cancelled":
      return "This task is cancelled.";
    case "task_not_shareable":
      return "This task is not eligible for Share Cast rewards.";
    case "farcaster_required":
      return "Connect a Farcaster-linked wallet to verify this share.";
    case "already_credited":
      return "This Farcaster account already earned the Share Cast reward for this task.";
    case "valid_wallet_required":
      return "Connect a wallet to verify this share.";
    case "missing_cast":
      return "No matching Share Cast was found yet. Publish the cast, then verify.";
    case "wrong_author":
      return "That cast is not from the Farcaster account linked to this wallet.";
    case "reply":
      return "Replies do not count. Publish an original cast with the task embed.";
    case "recast_or_quote":
      return "Recasts and quotes do not count. Publish an original cast.";
    case "listing_url":
      return "Share the specific task page, not the /tasks listing.";
    case "url_in_text_only":
      return "The task URL must be an embed, not only mentioned in the text.";
    case "wrong_task_url":
      return "The cast must embed this task's Mini App URL.";
    case "stale_cast":
      return "That cast is too old. Share again, then verify within 24 hours.";
    case "before_task":
      return "That cast was created before this task existed.";
    case "unfetchable":
      return "The cast could not be fetched. Try Verify Share again.";
    case "proof_failed":
      return "Share Cast was not verified. No BQR was awarded.";
    default:
      return "Share Cast was not verified. No BQR was awarded.";
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
  shareSnapRewardBqr = "0",
  compact = false,
}: ShareActionsProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [earnedBqr, setEarnedBqr] = useState<number | null>(null);
  const [lastCredit, setLastCredit] = useState<number | null>(null);
  const { address } = useAccount();
  const walletScore = useWalletScoreData();
  const taskUrl = canonicalTaskUrl(taskId);
  const scoreUrl = canonicalScoreUrl();
  const canVerifyShare = Boolean(shareCastEnabled && taskId);
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

  const refreshEarned = useCallback(async () => {
    if (!address) {
      setEarnedBqr(null);
      return;
    }
    try {
      const rewards = await fetchTask2EarnRewards(address);
      setEarnedBqr(rewards.earnedBqr);
    } catch {
      // Balance is informational; share/verify still works without it.
    }
  }, [address]);

  useEffect(() => {
    void refreshEarned();
  }, [refreshEarned]);

  const verifyShare = useCallback(
    async (castHash?: string | null) => {
      if (!taskId) {
        setMessage("Create the task before verifying a Share Cast reward.");
        return;
      }
      if (!address) {
        setMessage("Connect a wallet to verify this share.");
        return;
      }
      setVerifying(true);
      try {
        const result = await requestShareCastReward(taskId, address, castHash);
        setLastCredit(result.amountBqr);
        setEarnedBqr(result.earnedBqr);
        setMessage(
          result.alreadyCredited
            ? `Already credited. ${T2E_EARNED_BQR_LABEL}: ${result.earnedBqr} BQR.`
            : `+${result.amountBqr} BQR earned. ${T2E_EARNED_BQR_LABEL}: ${result.earnedBqr} BQR.`,
        );
      } catch (error) {
        setLastCredit(null);
        setMessage(
          shareRewardMessage(
            error instanceof Error ? error.message : "proof_failed",
          ),
        );
      } finally {
        setVerifying(false);
      }
    },
    [address, taskId],
  );

  const onCast = useCallback(async () => {
    setLastCredit(null);
    setMessage(null);
    const composed = await openShareCastComposer(castText, taskUrl);
    if (!composed.openedInMiniApp) {
      openBrowserComposer(castText, taskUrl);
      setMessage(
        "Publish the cast, then tap Verify Share. Opening the composer does not award BQR.",
      );
      return;
    }
    if (composed.hash) {
      await verifyShare(composed.hash);
      return;
    }
    setMessage(
      "Publish the cast, then tap Verify Share. Opening the composer does not award BQR.",
    );
  }, [castText, taskUrl, verifyShare]);

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
      {canVerifyShare ? (
        <button
          type="button"
          title="Verify Share Cast with the server"
          disabled={verifying || !address}
          onClick={() => void verifyShare()}
          className="inline-flex min-h-10 items-center justify-center rounded-full border border-amber-300/35 bg-amber-500/15 px-3 text-[0.7rem] font-semibold uppercase tracking-wide text-amber-100 disabled:opacity-50"
        >
          {verifying ? "Verifying…" : "Verify Share"}
        </button>
      ) : null}
      {!compact && (shareCastEnabled || shareSnapEnabled) ? (
        <p className="text-[0.65rem] text-white/40">
          {shareCastEnabled
            ? `Share Cast: share this Task2Earn campaign, then verify to earn ${SHARE_CAST_REWARD_BQR} BQR off-chain. `
            : ""}
          {shareSnapEnabled
            ? "Share Snap: share your social reputation scores. "
            : ""}
          {shareSnapEnabled
            ? ` Snap intent ${formatTokenAmount(shareSnapRewardBqr, "BQR")}.`
            : ""}{" "}
          Share Snap is not transferred.
        </p>
      ) : null}
      {lastCredit !== null ? (
        <p className="text-[0.75rem] font-semibold text-emerald-200">
          +{lastCredit} BQR earned
        </p>
      ) : null}
      {earnedBqr !== null ? (
        <p className="text-[0.65rem] text-cyan-100/80">
          {T2E_EARNED_BQR_LABEL}: {earnedBqr} BQR
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
