import { toRewardId } from "@/lib/rewards/rewardIds";
import { loadWalletEligibilitySnapshot } from "@/lib/rewards/server/eligibility";
import { syncWalletClaims } from "@/lib/rewards/server/claimSync";
import { listAllocationsForWallet } from "@/lib/supabase/rewardAllocations";
import { getPublishedCampaigns } from "@/lib/supabase/rewardCampaigns";
import {
  isValidWalletAddress,
  normalizeWalletAddress,
} from "@/lib/x/config";

export type PendingRewardApiItem = {
  actionId: string;
  actionKey: string | null;
  kind: string;
  label: string;
  amountBqr: number;
  units: number;
  status: string;
  reason: string;
  /** Present when a published allocation exists for claiming. */
  claimable: null | {
    campaignUuid: string;
    onChainCampaignId: number;
    rewardId: string;
    amountWei: string;
    claimedOnChain: boolean;
  };
};

export type PendingRewardsApiResponse = {
  wallet: string;
  items: PendingRewardApiItem[];
  totalPendingBqr: number;
  eligibleCount: number;
  claimableCount: number;
  publishedCampaigns: Array<{
    id: string;
    name: string;
    onChainCampaignId: number | null;
  }>;
  synced: { checked: number; newlyClaimed: number } | null;
};

/**
 * Pending rewards for a wallet: eligibility catalog + published claim slots.
 */
export async function getPendingRewardsForWallet(
  walletAddress: string,
  options?: { syncClaims?: boolean },
): Promise<PendingRewardsApiResponse> {
  if (!isValidWalletAddress(walletAddress)) {
    throw new Error("Invalid wallet address");
  }

  const wallet = normalizeWalletAddress(walletAddress);

  let synced: PendingRewardsApiResponse["synced"] = null;
  if (options?.syncClaims !== false) {
    try {
      synced = await syncWalletClaims(wallet);
    } catch {
      // Distributor may be unset in local/dev; still return eligibility.
      synced = null;
    }
  }

  const allocations = await listAllocationsForWallet(wallet, {
    publishedOnly: true,
  });

  // Eligibility "already claimed" follows on-chain settlement only.
  // Allocated-but-unclaimed leaves are exposed via `claimable`.
  const claimedActionIds = allocations
    .filter((a) => a.claimed_on_chain && !a.action_key.startsWith("referral:"))
    .map((a) => a.action_key);
  const claimedReferralCount = allocations.filter(
    (a) => a.action_key.startsWith("referral:") && a.claimed_on_chain,
  ).length;

  const snapshot = await loadWalletEligibilitySnapshot({
    walletAddress: wallet,
    claimedActionIds,
    claimedReferralCount,
  });

  const campaigns = await getPublishedCampaigns();
  const campaignById = new Map(campaigns.map((c) => [c.id, c]));

  const allocationByActionKey = new Map(
    allocations.map((a) => [a.action_key, a]),
  );

  const items: PendingRewardApiItem[] = snapshot.pending.items.map((item) => {
    if (item.kind === "referral" || item.actionId === "referral") {
      return {
        actionId: String(item.actionId),
        actionKey: null,
        kind: item.kind,
        label: item.label,
        amountBqr: item.amountBqr,
        units: item.units,
        status: item.status,
        reason: item.reason,
        claimable: null,
      };
    }

    const actionKey = String(item.actionId);
    const allocation = allocationByActionKey.get(actionKey);
    const campaign = allocation
      ? campaignById.get(allocation.campaign_id)
      : undefined;

    return {
      actionId: actionKey,
      actionKey,
      kind: item.kind,
      label: item.label,
      amountBqr: item.amountBqr,
      units: item.units,
      status: item.status,
      reason: item.reason,
      claimable:
        allocation &&
        campaign?.on_chain_campaign_id != null &&
        !allocation.claimed_on_chain
          ? {
              campaignUuid: campaign.id,
              onChainCampaignId: campaign.on_chain_campaign_id,
              rewardId: allocation.reward_id,
              amountWei: String(allocation.amount_wei),
              claimedOnChain: allocation.claimed_on_chain,
            }
          : null,
    };
  });

  // Surface claimable referral leaves individually for the proof API.
  for (const allocation of allocations) {
    if (!allocation.action_key.startsWith("referral:")) {
      continue;
    }
    if (allocation.claimed_on_chain) {
      continue;
    }
    const campaign = campaignById.get(allocation.campaign_id);
    if (!campaign || campaign.on_chain_campaign_id == null) {
      continue;
    }
    items.push({
      actionId: "referral",
      actionKey: allocation.action_key,
      kind: "referral",
      label: `Referral ${allocation.action_key}`,
      amountBqr: Number(allocation.amount_bqr),
      units: 1,
      status: "eligible",
      reason: "Published referral allocation ready to claim.",
      claimable: {
        campaignUuid: campaign.id,
        onChainCampaignId: campaign.on_chain_campaign_id,
        rewardId: allocation.reward_id,
        amountWei: String(allocation.amount_wei),
        claimedOnChain: false,
      },
    });
  }

  const claimableCount = items.filter((i) => i.claimable).length;

  return {
    wallet,
    items,
    totalPendingBqr: snapshot.pending.totalPendingBqr,
    eligibleCount: snapshot.pending.eligibleCount,
    claimableCount,
    publishedCampaigns: campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      onChainCampaignId: c.on_chain_campaign_id,
    })),
    synced,
  };
}

/** Resolve rewardId for a one-time action id (for clients that only know actionId). */
export function rewardIdForActionKey(actionKey: string) {
  return toRewardId(actionKey);
}
