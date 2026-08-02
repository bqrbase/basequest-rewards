"use client";

import { clearWalletAuthClientSession } from "@/lib/wallet/auth/clientLogout";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useDisconnect } from "wagmi";

/**
 * Disconnects the wallet after clearing ownership session cookies and
 * Genesis access query cache. UI callers keep the same disconnect API.
 */
export function useWalletDisconnect() {
  const queryClient = useQueryClient();
  const { disconnect, disconnectAsync, isPending, ...rest } = useDisconnect();

  const disconnectWallet = useCallback(() => {
    void (async () => {
      await clearWalletAuthClientSession(queryClient);
      disconnect();
    })();
  }, [disconnect, queryClient]);

  const disconnectWalletAsync = useCallback(async () => {
    await clearWalletAuthClientSession(queryClient);
    await disconnectAsync();
  }, [disconnectAsync, queryClient]);

  return {
    ...rest,
    isPending,
    disconnect: disconnectWallet,
    disconnectAsync: disconnectWalletAsync,
  };
}
