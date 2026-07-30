import {
  BASEQUEST_GENESIS_ABI,
  BASEQUEST_GENESIS_ADDRESS,
  BASEQUEST_GENESIS_HOLDER_TOKEN_ID,
} from "@/lib/contracts/abi/BaseQuestGenesis";
import { resolveGenesisAccess } from "@/lib/genesis/access/permissions";
import { isHoldingGenesis } from "@/lib/genesis/features";
import type { GenesisAccessPermissions } from "@/lib/genesis/access/types";
import { createPublicClient, http, type Address } from "viem";
import { base } from "viem/chains";

function getBaseRpcUrl(): string {
  return (
    process.env.BASE_RPC_URL ||
    process.env.NEXT_PUBLIC_BASE_RPC_URL ||
    "https://mainnet.base.org"
  );
}

/**
 * Server-side Genesis holder detection via ERC-1155 balanceOf.
 * Used when awarding real Genesis XP bonuses.
 */
export async function readGenesisHolderBalance(
  walletAddress: string,
): Promise<bigint> {
  const client = createPublicClient({
    chain: base,
    transport: http(getBaseRpcUrl()),
  });

  return client.readContract({
    address: BASEQUEST_GENESIS_ADDRESS,
    abi: BASEQUEST_GENESIS_ABI,
    functionName: "balanceOf",
    args: [
      walletAddress as Address,
      BASEQUEST_GENESIS_HOLDER_TOKEN_ID,
    ],
  });
}

export async function resolveServerGenesisAccess(
  walletAddress: string,
): Promise<GenesisAccessPermissions> {
  try {
    const balance = await readGenesisHolderBalance(walletAddress);
    return resolveGenesisAccess(isHoldingGenesis(balance));
  } catch (error) {
    console.error("[resolveServerGenesisAccess]", error);
    // Fail closed: no bonus if RPC/holder check fails.
    return resolveGenesisAccess(false);
  }
}
