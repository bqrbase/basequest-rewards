"use client";

import {
  BASEQUEST_GENESIS_ABI,
  BASEQUEST_GENESIS_ADDRESS,
  BASEQUEST_GENESIS_HOLDER_TOKEN_ID,
} from "@/lib/contracts/abi/BaseQuestGenesis";
import {
  isHoldingGenesis,
  type GenesisHolderState,
} from "@/lib/genesis";
import type { Address } from "viem";
import { base } from "viem/chains";
import { useAccount, useReadContract } from "wagmi";

/**
 * Detect whether a wallet holds BaseQuest Genesis (token id 1).
 * Defaults to the connected wallet when `address` is omitted.
 */
export function useGenesisHolder(address?: Address): GenesisHolderState {
  const { address: connectedAddress } = useAccount();
  const account = address ?? connectedAddress;
  const enabled = Boolean(account);

  const { data, isLoading } = useReadContract({
    abi: BASEQUEST_GENESIS_ABI,
    address: BASEQUEST_GENESIS_ADDRESS,
    functionName: "balanceOf",
    args: account
      ? [account, BASEQUEST_GENESIS_HOLDER_TOKEN_ID]
      : undefined,
    chainId: base.id,
    query: {
      enabled,
      staleTime: 30_000,
      refetchOnWindowFocus: true,
    },
  });

  const loading = enabled && isLoading;
  const balance = data ?? 0n;
  const isGenesisHolder = enabled && !loading && isHoldingGenesis(balance);

  return {
    isGenesisHolder,
    balance,
    loading,
  };
}
