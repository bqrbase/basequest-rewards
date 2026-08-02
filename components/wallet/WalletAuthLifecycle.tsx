"use client";

import { clearWalletAuthClientSession } from "@/lib/wallet/auth/clientLogout";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useAccount } from "wagmi";

/**
 * Clears wallet ownership session + Genesis query cache on disconnect.
 * Does NOT request a signature on connect — auth is lazy (first protected action).
 */
export default function WalletAuthLifecycle() {
  const { address, status } = useAccount();
  const queryClient = useQueryClient();
  const hadConnectedWallet = useRef(false);

  useEffect(() => {
    if (status === "connecting" || status === "reconnecting") {
      return;
    }

    if (status === "connected" && address) {
      hadConnectedWallet.current = true;
      return;
    }

    if (hadConnectedWallet.current) {
      hadConnectedWallet.current = false;
      void clearWalletAuthClientSession(queryClient);
    }
  }, [address, queryClient, status]);

  return null;
}
