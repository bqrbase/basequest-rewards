"use client";

import { FarcasterIcon } from "@/components/icons/SocialIcons";
import { useWalletAuth } from "@/hooks/useWalletAuth";
import { FARCASTER_FOLLOW_QUEST_TARGET } from "@/lib/community-quests";
import { ui } from "@/lib/ui-styles";
import type { QuestProgress, QuestStatus } from "@/lib/quest-engine";
import { useState } from "react";
import { useAccount } from "wagmi";

type FollowFarcasterQuestButtonProps = {
  status: QuestStatus;
  buttonClassName: string;
  disabledClassName: string;
  onCompleted: (progress: QuestProgress) => void;
};

/**
 * Opens the Farcaster profile inside Base App / Farcaster when possible,
 * otherwise falls back to the system browser.
 */
async function openFarcasterProfile(url: string) {
  try {
    const { sdk } = await import("@farcaster/miniapp-sdk");
    const isMiniApp = await sdk.isInMiniApp();
    if (isMiniApp) {
      await sdk.actions.openUrl(url);
      return;
    }
  } catch {
    // Not in a mini app host, or openUrl unavailable — use browser.
  }

  window.open(url, "_blank", "noopener,noreferrer");
}

/** Read the connected Farcaster user's FID from Mini App context when available. */
async function readConnectedFid(): Promise<number | null> {
  try {
    const { sdk } = await import("@farcaster/miniapp-sdk");
    const isMiniApp = await sdk.isInMiniApp();
    if (!isMiniApp) {
      return null;
    }

    const context = await sdk.context;
    const fid = context?.user?.fid;
    return typeof fid === "number" && fid > 0 ? fid : null;
  } catch {
    return null;
  }
}

/**
 * Farcaster community quest actions with Neynar-backed verify-follow.
 */
export default function FollowFarcasterQuestButton({
  status,
  buttonClassName,
  disabledClassName,
  onCompleted,
}: FollowFarcasterQuestButtonProps) {
  const { address, status: walletStatus } = useAccount();
  const { ensureWalletAuth } = useWalletAuth();
  const isWalletConnected = walletStatus === "connected" && Boolean(address);
  const [isVerifying, setIsVerifying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (status === "completed") {
    return (
      <button
        type="button"
        disabled
        className={`${disabledClassName} inline-flex w-full items-center justify-center gap-2`}
      >
        <FarcasterIcon className="size-3.5 shrink-0" />
        Completed
      </button>
    );
  }

  if (status === "locked") {
    return (
      <button type="button" disabled className={`${disabledClassName} w-full`}>
        Locked
      </button>
    );
  }

  function handleFollow() {
    setMessage(null);
    setErrorMessage(null);
    void openFarcasterProfile(FARCASTER_FOLLOW_QUEST_TARGET.profileUrl);
  }

  async function handleVerify() {
    if (!address || !isWalletConnected || isVerifying) {
      setErrorMessage("Connect your wallet to verify.");
      return;
    }

    setIsVerifying(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const auth = await ensureWalletAuth();
      if (!auth.ok) {
        setErrorMessage(
          auth.error === "wallet_not_connected"
            ? "Connect your wallet to verify."
            : "Sign the wallet ownership message to continue.",
        );
        return;
      }

      const fid = await readConnectedFid();

      const response = await fetch("/api/auth/farcaster/verify-follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          wallet: address,
          ...(fid ? { fid } : {}),
        }),
      });

      const json = (await response.json()) as {
        success?: boolean;
        error?: string;
        progress?: QuestProgress;
      };

      if (json.success && json.progress) {
        onCompleted(json.progress);
        setMessage(null);
        setErrorMessage(null);
        return;
      }

      setErrorMessage(
        json.error || "Please follow @hqc first.",
      );
    } catch (error) {
      console.error("[FollowFarcasterQuestButton] verify exception:", error);
      setErrorMessage(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setIsVerifying(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleFollow}
        className={`${buttonClassName} inline-flex w-full items-center justify-center gap-2`}
      >
        <FarcasterIcon className="size-3.5 shrink-0" />
        Follow @{FARCASTER_FOLLOW_QUEST_TARGET.username}
      </button>
      <button
        type="button"
        disabled={isVerifying || !isWalletConnected}
        onClick={() => void handleVerify()}
        className={`${isVerifying || !isWalletConnected ? disabledClassName : ui.secondaryButton} inline-flex w-full items-center justify-center gap-2`}
      >
        {isVerifying ? "Verifying…" : "Verify Follow"}
      </button>
      {!isWalletConnected ? (
        <p className="text-center text-xs text-white/45">
          Connect your wallet to verify.
        </p>
      ) : null}
      {message ? (
        <p className="text-center text-xs text-white/55">{message}</p>
      ) : null}
      {errorMessage ? (
        <p className="text-center text-xs text-rose-300/90">{errorMessage}</p>
      ) : null}
    </div>
  );
}
