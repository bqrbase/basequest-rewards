"use client";

import { useWalletAuth } from "@/hooks/useWalletAuth";
import { clearWalletAuthClientSession } from "@/lib/wallet/auth/clientLogout";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useAccount } from "wagmi";

/**
 * Establishes wallet ownership session after connect.
 * Clears auth cookies + Genesis cache when the wallet disconnects.
 * No visible UI — required before XP award / privileged write APIs.
 */
export default function WalletAuthLifecycle() {
  const { address, status } = useAccount();
  const { ensureWalletAuth } = useWalletAuth();
  const queryClient = useQueryClient();
  const lastWallet = useRef<string | null>(null);
  const hadConnectedWallet = useRef(false);

  useEffect(() => {
    if (status === "connecting" || status === "reconnecting") {
      return;
    }

    if (status === "connected" && address) {
      hadConnectedWallet.current = true;
      const normalized = address.toLowerCase();
      if (lastWallet.current === normalized) {
        return;
      }
      lastWallet.current = normalized;

      void ensureWalletAuth().then((result) => {
        if (!result.ok) {
          console.warn("[WalletAuthLifecycle]", result.error);
        }
      });
      return;
    }

    // Disconnect (or account cleared): end ownership session and reset cache.
    if (hadConnectedWallet.current) {
      hadConnectedWallet.current = false;
      lastWallet.current = null;
      void clearWalletAuthClientSession(queryClient);
    }
  }, [address, ensureWalletAuth, queryClient, status]);

  return null;
}
