import { readIsClaimed } from "@/lib/rewards/server/baseClient";
import {
  listAllocationsForCampaign,
  listAllocationsForWallet,
  markAllocationClaimed,
  type RewardAllocationRow,
} from "@/lib/supabase/rewardAllocations";
import {
  getPublishedCampaigns,
  getRewardCampaign,
} from "@/lib/supabase/rewardCampaigns";
import { getAddress, type Hex } from "viem";

/**
 * Synchronize claimed_on_chain flags from RewardsDistributor.isClaimed.
 * Read-only on-chain; no privileged txs.
 */

export async function syncAllocationClaimStatus(
  allocation: RewardAllocationRow,
  onChainCampaignId: number,
): Promise<boolean> {
  const claimed = await readIsClaimed({
    campaignId: BigInt(onChainCampaignId),
    account: getAddress(allocation.wallet_address),
    rewardId: allocation.reward_id as Hex,
  });

  if (claimed !== allocation.claimed_on_chain) {
    await markAllocationClaimed({
      allocationId: allocation.id,
      claimed,
      txHash: allocation.claim_tx_hash,
    });
  }

  return claimed;
}

export async function syncWalletClaims(walletAddress: string): Promise<{
  checked: number;
  newlyClaimed: number;
}> {
  const allocations = await listAllocationsForWallet(walletAddress, {
    publishedOnly: true,
  });

  const campaigns = await getPublishedCampaigns();
  const campaignIdToOnChain = new Map(
    campaigns.map((c) => [c.id, c.on_chain_campaign_id]),
  );

  let newlyClaimed = 0;
  for (const allocation of allocations) {
    const onChainId = campaignIdToOnChain.get(allocation.campaign_id);
    if (onChainId == null) {
      continue;
    }
    const before = allocation.claimed_on_chain;
    const claimed = await syncAllocationClaimStatus(allocation, onChainId);
    if (claimed && !before) {
      newlyClaimed += 1;
    }
  }

  return { checked: allocations.length, newlyClaimed };
}

export async function syncCampaignClaims(campaignUuid: string): Promise<{
  checked: number;
  claimedCount: number;
}> {
  const campaign = await getRewardCampaign(campaignUuid);
  if (!campaign) {
    throw new Error("Campaign not found");
  }
  if (campaign.status !== "published" || campaign.on_chain_campaign_id == null) {
    throw new Error("Campaign must be published with an on-chain id to sync");
  }

  const allocations = await listAllocationsForCampaign(campaignUuid);
  let claimedCount = 0;

  for (const allocation of allocations) {
    const claimed = await syncAllocationClaimStatus(
      allocation,
      campaign.on_chain_campaign_id,
    );
    if (claimed) {
      claimedCount += 1;
    }
  }

  return { checked: allocations.length, claimedCount };
}
