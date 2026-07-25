"use client";

import { useCallback } from "react";
import { useWriteContract } from "wagmi";
import { useEnsureBaseMainnet } from "@/hooks/useEnsureBaseMainnet";

/**
 * wagmi writeContract that always switches to Base Mainnet (8453) first.
 * Prefer this over raw useWriteContract for any on-chain write.
 */
export function useWriteContractOnBase() {
  const write = useWriteContract();
  const { ensureBaseMainnetReady } = useEnsureBaseMainnet();

  const writeContractAsync = useCallback(
    async (
      variables: Parameters<typeof write.writeContractAsync>[0],
    ) => {
      const chainId = await ensureBaseMainnetReady();
      return write.writeContractAsync({
        ...variables,
        chainId,
      });
    },
    [ensureBaseMainnetReady, write.writeContractAsync],
  );

  return {
    ...write,
    writeContractAsync,
  };
}
