"use client";

import { useAppEnvironment } from "@/hooks/useAppEnvironment";
import { detectAppEnvironment } from "@/lib/miniapp/environment";
import { getPreferredConnector } from "@/lib/wallet/getPreferredConnector";
import { useAccount, useConnect } from "wagmi";

type ConnectWalletButtonProps = {
  connectLabel?: string;
  connectingLabel?: string;
  completedLabel?: string;
  buttonClassName: string;
  disabledClassName: string;
  questCompleted?: boolean;
  className?: string;
};

/**
 * Connect Wallet — host-aware connect only.
 * Never requests a signature or ownership session.
 */
export default function ConnectWalletButton({
  connectLabel = "Connect Wallet",
  connectingLabel = "Connecting...",
  completedLabel,
  buttonClassName,
  disabledClassName,
  questCompleted = false,
  className = "",
}: ConnectWalletButtonProps) {
  const account = useAccount();
  const { isConnected } = account;
  const { connect, connectors, isPending } = useConnect();
  const { environment, isReady } = useAppEnvironment();

  if (completedLabel && questCompleted) {
    return (
      <button
        type="button"
        disabled
        className={`${disabledClassName} ${className}`.trim()}
      >
        {completedLabel}
      </button>
    );
  }

  const handleConnect = async () => {
    const resolvedEnvironment = isReady
      ? environment
      : await detectAppEnvironment();

    const connector = getPreferredConnector(connectors, resolvedEnvironment);

    if (!connector) {
      console.error("[ConnectWalletButton] No connector found");
      return;
    }

    connect({ connector });
  };

  const disabled = isPending || isConnected;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        void handleConnect();
      }}
      className={`${
        disabled ? disabledClassName : buttonClassName
      } ${className}`.trim()}
    >
      {isPending ? connectingLabel : connectLabel}
    </button>
  );
}
