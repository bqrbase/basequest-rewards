import { syncAllocationClaimStatus } from "@/lib/rewards/server/claimSync";
import { getAllocationByRewardId } from "@/lib/supabase/rewardAllocations";
import { toRewardId } from "@/lib/rewards/rewardIds";
import {
  isValidWalletAddress,
  normalizeWalletAddress,
} from "@/lib/x/config";
import type { Hex } from "viem";

export type ClaimProofResponse = {
  wallet: string;
  campaignUuid: string;
  onChainCampaignId: number;
  actionKey: string;
  rewardId: Hex;
  amountWei: string;
  amountBqr: number;
  merkleProof: Hex[];
  leafHash: string;
  leafIndex: number;
  claimedOnChain: boolean;
  distributorConfigured: boolean;
};

/**
 * Return Merkle proof payload for RewardsDistributor.claim(...).
 * Does not submit transactions.
 */
export async function getClaimProof(params: {
  walletAddress: string;
  onChainCampaignId: number;
  /** Either rewardId (0x…) or actionKey (e.g. daily-check-in / referral:1). */
  rewardIdOrActionKey: string;
}): Promise<ClaimProofResponse> {
  if (!isValidWalletAddress(params.walletAddress)) {
    throw new Error("Invalid wallet address");
  }
  if (
    !Number.isInteger(params.onChainCampaignId) ||
    params.onChainCampaignId < 1
  ) {
    throw new Error("Invalid onChainCampaignId");
  }

  const wallet = normalizeWalletAddress(params.walletAddress);
  const raw = params.rewardIdOrActionKey.trim();
  const rewardId = (
    raw.startsWith("0x") && raw.length === 66 ? raw.toLowerCase() : toRewardId(raw)
  ) as Hex;

  const allocation = await getAllocationByRewardId({
    walletAddress: wallet,
    onChainCampaignId: params.onChainCampaignId,
    rewardId,
  });

  if (!allocation) {
    throw new ClaimProofNotFoundError(
      "No published allocation found for this wallet/campaign/reward",
    );
  }

  let claimedOnChain = allocation.claimed_on_chain;
  try {
    claimedOnChain = await syncAllocationClaimStatus(
      allocation,
      params.onChainCampaignId,
    );
  } catch {
    // Keep stored flag if RPC unavailable.
  }

  if (claimedOnChain) {
    throw new ClaimProofAlreadyClaimedError("Reward already claimed on-chain");
  }

  if (
    !allocation.leaf_hash ||
    allocation.leaf_index === null ||
    allocation.leaf_index === undefined
  ) {
    throw new ClaimProofNotFoundError(
      "Allocation is not Merkle-materialized yet (campaign build incomplete)",
    );
  }

  const proof = Array.isArray(allocation.merkle_proof)
    ? (allocation.merkle_proof as Hex[])
    : [];

  return {
    wallet,
    campaignUuid: allocation.campaign.id,
    onChainCampaignId: params.onChainCampaignId,
    actionKey: allocation.action_key,
    rewardId: allocation.reward_id as Hex,
    amountWei: String(allocation.amount_wei),
    amountBqr: Number(allocation.amount_bqr),
    merkleProof: proof,
    leafHash: allocation.leaf_hash,
    leafIndex: allocation.leaf_index,
    claimedOnChain: false,
    distributorConfigured: Boolean(
      process.env.NEXT_PUBLIC_REWARDS_DISTRIBUTOR?.trim(),
    ),
  };
}

export class ClaimProofNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClaimProofNotFoundError";
  }
}

export class ClaimProofAlreadyClaimedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClaimProofAlreadyClaimedError";
  }
}
