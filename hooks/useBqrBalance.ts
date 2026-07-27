"use client";

import { getBqrTokenAddress } from "@/lib/token/bqr";
import { useMemo } from "react";
import { erc20Abi, formatUnits, type Address } from "viem";
import { base } from "viem/chains";
import { useAccount, useReadContracts } from "wagmi";

export type BqrBalanceState =
  | { status: "disconnected"; refetch: () => void }
  | { status: "loading"; refetch: () => void }
  | { status: "error"; message: string; refetch: () => void }
  | {
      status: "ready";
      raw: bigint;
      decimals: number;
      formatted: string;
      display: string;
      refetch: () => void;
    };

function formatBqrDisplay(raw: bigint, decimals: number): string {
  const asNumber = Number(formatUnits(raw, decimals));
  if (!Number.isFinite(asNumber)) {
    return formatUnits(raw, decimals);
  }
  if (asNumber === 0) {
    return "0";
  }
  if (asNumber > 0 && asNumber < 0.0001) {
    return "<0.0001";
  }
  return asNumber.toLocaleString(undefined, {
    maximumFractionDigits: 4,
  });
}

/**
 * Read connected wallet BQR balance via B20's ERC-20-compatible
 * balanceOf + decimals surface on Base Mainnet.
 */
export function useBqrBalance(): BqrBalanceState {
  const { address, status: walletStatus } = useAccount();
  const isConnected = walletStatus === "connected" && Boolean(address);
  const tokenAddress = getBqrTokenAddress();

  const contracts = useMemo(
    () =>
      [
        {
          address: tokenAddress,
          abi: erc20Abi,
          functionName: "balanceOf" as const,
          args: [address as Address],
          chainId: base.id,
        },
        {
          address: tokenAddress,
          abi: erc20Abi,
          functionName: "decimals" as const,
          chainId: base.id,
        },
      ] as const,
    [address, tokenAddress],
  );

  const query = useReadContracts({
    contracts,
    query: {
      enabled: Boolean(isConnected && address),
      staleTime: 30_000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  });

  const refetch = () => {
    void query.refetch();
  };

  if (!isConnected || !address) {
    return { status: "disconnected", refetch };
  }

  if (query.isLoading || query.isPending) {
    return { status: "loading", refetch };
  }

  const balanceResult = query.data?.[0];
  const decimalsResult = query.data?.[1];

  if (
    query.isError ||
    !balanceResult ||
    !decimalsResult ||
    balanceResult.status !== "success" ||
    decimalsResult.status !== "success"
  ) {
    return {
      status: "error",
      message: "Unable to load BQR balance",
      refetch,
    };
  }

  const raw = balanceResult.result as bigint;
  const decimals = Number(decimalsResult.result);
  const safeDecimals = Number.isFinite(decimals) ? decimals : 18;
  const formatted = formatUnits(raw, safeDecimals);

  return {
    status: "ready",
    raw,
    decimals: safeDecimals,
    formatted,
    display: formatBqrDisplay(raw, safeDecimals),
    refetch,
  };
}
