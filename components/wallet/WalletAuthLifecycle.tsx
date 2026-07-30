"use client";

import { useWalletAuth } from "@/hooks/useWalletAuth";
import { useEffect, useRef } from "react";
import { useAccount } from "wagmi";

/**
 * Establishes wallet ownership session after connect.
 * No visible UI — required before XP award / privileged write APIs.
 */
export default function WalletAuthLifecycle() {
  const { address, status } = useAccount();
  const { ensureWalletAuth } = useWalletAuth();
  const lastWallet = useRef<string | null>(null);

  useEffect(() => {
    if (status !== "connected" || !address) {
      lastWallet.current = null;
      return;
    }

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
  }, [address, ensureWalletAuth, status]);

  return null;
}
