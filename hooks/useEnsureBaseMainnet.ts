"use client";

import { useCallback } from "react";
import { base } from "viem/chains";
import { useChainId, useConfig, useSwitchChain } from "wagmi";
import { ensureBaseMainnet } from "@/lib/wallet/ensureBaseMainnet";

/**
 * Returns a function that switches the wallet to Base Mainnet (8453) when needed.
 * Call this before every writeContract / deploy / payment flow.
 */
export function useEnsureBaseMainnet() {
  const config = useConfig();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();

  const ensureBaseMainnetReady = useCallback(async (): Promise<
    typeof base.id
  > => {
    return ensureBaseMainnet({
      config,
      currentChainId: chainId,
      switchChainAsync,
    });
  }, [config, chainId, switchChainAsync]);

  return { ensureBaseMainnetReady, chainId };
}
