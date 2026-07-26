"use client";

import ConnectWalletButton from "@/components/ConnectWalletButton";
import GlassPanel from "@/components/GlassPanel";
import { formatWalletAddress, ui } from "@/lib/ui-styles";
import { useAccount, useDisconnect } from "wagmi";

type WalletStatusCardProps = {
  className?: string;
};

export default function WalletStatusCard({
  className = "",
}: WalletStatusCardProps) {
  const { address, status } = useAccount();
  const { disconnect, isPending: isDisconnecting } = useDisconnect();

  const isConnected = status === "connected";

  return (
    <GlassPanel className={`h-full ${ui.dashCardPad} ${className}`}>
      <div className="flex h-full flex-col">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span
              className={`relative flex size-11 shrink-0 items-center justify-center rounded-2xl border ${
                isConnected
                  ? "border-emerald-400/30 bg-emerald-500/10"
                  : "border-white/10 bg-white/[0.04]"
              }`}
              aria-hidden
            >
              <span
                className={`size-2.5 rounded-full ${
                  isConnected
                    ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.55)]"
                    : "bg-white/35"
                }`}
              />
            </span>
            <div className="min-w-0">
              <p className={ui.statLabel}>Wallet</p>
              <p className="mt-1 font-sans text-base font-semibold text-white sm:text-lg">
                {isConnected ? "Connected on Base" : "Not connected"}
              </p>
            </div>
          </div>

          {isConnected ? (
            <button
              type="button"
              disabled={isDisconnecting}
              onClick={() => disconnect()}
              className={`${ui.secondaryButton} w-full sm:w-auto sm:min-w-[140px]`}
            >
              {isDisconnecting ? "Disconnecting..." : "Disconnect"}
            </button>
          ) : (
            <ConnectWalletButton
              connectLabel="Connect"
              connectingLabel="Connecting..."
              buttonClassName={`${ui.primaryButton} w-full sm:w-auto sm:min-w-[140px]`}
              disabledClassName={`${ui.secondaryButton} w-full sm:w-auto sm:min-w-[140px] opacity-70`}
            />
          )}
        </div>

        <div className="mt-auto grid grid-cols-1 gap-3 pt-4 sm:grid-cols-2">
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-3">
            <p className={ui.statLabel}>Address</p>
            <p
              className="mt-1.5 truncate font-mono text-sm font-semibold tracking-wide text-white"
              title={address ?? undefined}
            >
              {isConnected && address ? formatWalletAddress(address) : "—"}
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-3">
            <p className={ui.statLabel}>Network</p>
            <p className="mt-1.5 font-sans text-sm font-semibold text-white">
              Base Mainnet
            </p>
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}
