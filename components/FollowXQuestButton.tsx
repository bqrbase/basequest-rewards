"use client";

import { XIcon } from "@/components/icons/SocialIcons";
import { ui } from "@/lib/ui-styles";
import type { QuestProgress, QuestStatus } from "@/lib/quest-engine";
import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type FollowXQuestButtonProps = {
  status: QuestStatus;
  buttonClassName: string;
  disabledClassName: string;
  onCompleted: (progress: QuestProgress) => void;
};

type ConnectionState =
  | { status: "loading" }
  | { status: "disconnected" }
  | { status: "connected"; username: string | null };

function getActionableButtonClass(disabled: boolean, base: string, disabledClass: string) {
  return disabled ? disabledClass : base;
}

export default function FollowXQuestButton({
  status,
  buttonClassName,
  disabledClassName,
  onCompleted,
}: FollowXQuestButtonProps) {
  const { address, status: walletStatus } = useAccount();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isWalletConnected = walletStatus === "connected" && Boolean(address);

  const [connection, setConnection] = useState<ConnectionState>({
    status: "loading",
  });
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refreshConnection = useCallback(async () => {
    if (!address || !isWalletConnected) {
      setConnection({ status: "disconnected" });
      return;
    }

    try {
      const response = await fetch(
        `/api/auth/x/login?wallet=${encodeURIComponent(address)}&check=1`,
        { cache: "no-store" },
      );
      const json = (await response.json()) as {
        connected?: boolean;
        username?: string | null;
      };

      if (json.connected) {
        setConnection({
          status: "connected",
          username: json.username ?? null,
        });
      } else {
        setConnection({ status: "disconnected" });
      }
    } catch {
      setConnection({ status: "disconnected" });
    }
  }, [address, isWalletConnected]);

  useEffect(() => {
    void refreshConnection();
  }, [refreshConnection]);

  useEffect(() => {
    const xAuth = searchParams.get("x_auth");
    if (!xAuth) {
      return;
    }

    if (xAuth === "connected") {
      setConnection({
        status: "connected",
        username: searchParams.get("x_user"),
      });
      setErrorMessage(null);
    } else if (xAuth === "error") {
      const code = searchParams.get("x_error") || "callback_failed";
      setErrorMessage(
        code === "access_denied"
          ? "X authorization was cancelled."
          : "Could not connect your X account. Please try again.",
      );
      setConnection({ status: "disconnected" });
    }

    const next = new URLSearchParams(searchParams.toString());
    next.delete("x_auth");
    next.delete("x_user");
    next.delete("x_error");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [searchParams, pathname, router]);

  function handleConnect() {
    if (!address || !isWalletConnected) {
      setErrorMessage("Connect your wallet before linking X.");
      return;
    }

    setErrorMessage(null);
    const returnTo = pathname.startsWith("/") ? pathname : "/quests";
    window.location.href = `/api/auth/x/login?wallet=${encodeURIComponent(address)}&returnTo=${encodeURIComponent(returnTo)}`;
  }

  async function handleVerify() {
    if (!address || !isWalletConnected || isVerifying) {
      return;
    }

    setIsVerifying(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/auth/x/verify-follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ wallet: address }),
      });

      const json = (await response.json()) as {
        status?: string;
        error?: string;
        progress?: QuestProgress;
      };

      if (json.status === "not_authenticated" || response.status === 401) {
        setConnection({ status: "disconnected" });
        setErrorMessage("Connect your X account to verify the follow.");
        return;
      }

      if (json.status === "not_following") {
        setErrorMessage(
          "You're not following @bqrbase yet. Follow the account, then verify again.",
        );
        return;
      }

      if (json.status === "completed" && json.progress) {
        onCompleted(json.progress);
        setErrorMessage(null);
        return;
      }

      setErrorMessage(json.error || "Verification failed. Please try again.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Verification failed.",
      );
    } finally {
      setIsVerifying(false);
    }
  }

  if (status === "completed") {
    return (
      <button
        type="button"
        disabled
        className={`${disabledClassName} inline-flex w-full items-center justify-center gap-2`}
      >
        <XIcon className="size-3.5 shrink-0" />
        Completed
      </button>
    );
  }

  if (status === "locked") {
    return (
      <button
        type="button"
        disabled
        className={`${disabledClassName} w-full`}
      >
        Locked
      </button>
    );
  }

  if (!isWalletConnected) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          disabled
          className={`${disabledClassName} inline-flex w-full items-center justify-center gap-2`}
        >
          <XIcon className="size-3.5 shrink-0" />
          Connect wallet first
        </button>
        {errorMessage ? (
          <p className="text-center text-xs text-rose-300/90">{errorMessage}</p>
        ) : null}
      </div>
    );
  }

  if (connection.status === "loading") {
    return (
      <button
        type="button"
        disabled
        className={`${disabledClassName} inline-flex w-full items-center justify-center gap-2`}
      >
        <XIcon className="size-3.5 shrink-0" />
        Checking X…
      </button>
    );
  }

  if (connection.status === "disconnected") {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={handleConnect}
          className={`${buttonClassName} inline-flex w-full items-center justify-center gap-2`}
        >
          <XIcon className="size-3.5 shrink-0" />
          Connect X
        </button>
        <a
          href="https://x.com/bqrbase"
          target="_blank"
          rel="noopener noreferrer"
          className={`${ui.secondaryButton} inline-flex w-full items-center justify-center gap-2`}
        >
          Follow @bqrbase
        </a>
        {errorMessage ? (
          <p className="text-center text-xs text-rose-300/90">{errorMessage}</p>
        ) : null}
      </div>
    );
  }

  const verifyDisabled = isVerifying;
  const verifyClass = getActionableButtonClass(
    verifyDisabled,
    buttonClassName,
    disabledClassName,
  );

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={verifyDisabled}
        onClick={() => void handleVerify()}
        className={`${verifyClass} inline-flex w-full items-center justify-center gap-2`}
      >
        <XIcon className="size-3.5 shrink-0" />
        {isVerifying ? "Verifying…" : "Verify Follow"}
      </button>
      <a
        href="https://x.com/bqrbase"
        target="_blank"
        rel="noopener noreferrer"
        className={`${ui.secondaryButton} inline-flex w-full items-center justify-center gap-2`}
      >
        Follow @bqrbase
      </a>
      {connection.username ? (
        <p className="text-center text-xs text-white/45">
          Connected as @{connection.username}
        </p>
      ) : null}
      {errorMessage ? (
        <p className="text-center text-xs text-rose-300/90">{errorMessage}</p>
      ) : null}
    </div>
  );
}
