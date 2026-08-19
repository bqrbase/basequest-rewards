"use client";

import { connectPreferredWallet, useWalletHost } from "@/lib/wallet";
import { useAccount, useConfig, useConnect } from "wagmi";

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
  const { isPending } = useConnect();
  const config = useConfig();
  const host = useWalletHost();

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
    try {
      await connectPreferredWallet({
        config,
        host,
      });
    } catch (error) {
      console.error("[ConnectWalletButton] connect failed:", error);
    }
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
