"use client";

import {
  BASEQUEST_GENESIS_ABI,
  BASEQUEST_GENESIS_ADDRESS,
  BASEQUEST_GENESIS_MAX_SUPPLY,
} from "@/lib/contracts/abi/BaseQuestGenesis";
import { base } from "viem/chains";
import { useReadContract } from "wagmi";

export type GenesisSupplyState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      totalMinted: bigint;
      maxSupply: bigint;
      remaining: bigint;
      progress: number;
    };

export function useGenesisSupply(): GenesisSupplyState {
  const { data, isLoading, isError, error } = useReadContract({
    abi: BASEQUEST_GENESIS_ABI,
    address: BASEQUEST_GENESIS_ADDRESS,
    functionName: "totalMinted",
    chainId: base.id,
    query: {
      refetchInterval: 30_000,
    },
  });

  if (isLoading) {
    return { status: "loading" };
  }

  if (isError || data === undefined) {
    return {
      status: "error",
      message: error?.message ?? "Failed to load collection supply.",
    };
  }

  const totalMinted = data;
  const maxSupply = BASEQUEST_GENESIS_MAX_SUPPLY;
  const remaining =
    totalMinted >= maxSupply ? 0n : maxSupply - totalMinted;
  const progress = Math.min(
    100,
    (Number(totalMinted) / Number(maxSupply)) * 100,
  );

  return {
    status: "ready",
    totalMinted,
    maxSupply,
    remaining,
    progress,
  };
}
