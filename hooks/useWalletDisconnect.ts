"use client";

import { BASEQUEST_GENESIS_ADDRESS } from "@/lib/contracts/abi/BaseQuestGenesis";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useDisconnect } from "wagmi";

/** Drop cached Genesis holder reads so access resets after disconnect. */
function resetGenesisAccessQueries(queryClient: QueryClient) {
  const genesisAddress = BASEQUEST_GENESIS_ADDRESS.toLowerCase();

  queryClient.removeQueries({
    predicate: (query) => {
      try {
        return JSON.stringify(query.queryKey).toLowerCase().includes(genesisAddress);
      } catch {
        return false;
      }
    },
  });
}

/**
 * Disconnects the wallet and clears Genesis access query cache.
 * UI callers keep the same disconnect API.
 */
export function useWalletDisconnect() {
  const queryClient = useQueryClient();
  const { disconnect, disconnectAsync, isPending, ...rest } = useDisconnect();

  const disconnectWallet = useCallback(() => {
    resetGenesisAccessQueries(queryClient);
    disconnect();
  }, [disconnect, queryClient]);

  const disconnectWalletAsync = useCallback(async () => {
    resetGenesisAccessQueries(queryClient);
    await disconnectAsync();
  }, [disconnectAsync, queryClient]);

  return {
    ...rest,
    isPending,
    disconnect: disconnectWallet,
    disconnectAsync: disconnectWalletAsync,
  };
}
