/**
 * Client-side fetch helpers for rewards claim UI.
 * Server APIs live under /api/rewards/* — this module does not mutate XP/quests.
 */

export type PendingRewardClaimable = {
  campaignUuid: string;
  onChainCampaignId: number;
  rewardId: string;
  amountWei: string;
  claimedOnChain: boolean;
};

export type PendingRewardItem = {
  actionId: string;
  actionKey: string | null;
  kind: string;
  label: string;
  amountBqr: number;
  units: number;
  status: string;
  reason: string;
  claimable: PendingRewardClaimable | null;
};

export type PendingRewardsResponse = {
  wallet: string;
  items: PendingRewardItem[];
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

export type ClaimProofResponse = {
  wallet: string;
  campaignId: number;
  campaignUuid: string;
  actionKey: string;
  rewardId: `0x${string}`;
  amount: string;
  amountBqr: number;
  merkleProof: `0x${string}`[];
  leafHash: string;
  leafIndex: number;
  claimedOnChain: boolean;
};

export async function fetchPendingRewards(
  wallet: string,
): Promise<PendingRewardsResponse> {
  const response = await fetch(
    `/api/rewards/pending?wallet=${encodeURIComponent(wallet)}`,
    { method: "GET", cache: "no-store" },
  );
  const json = (await response.json()) as PendingRewardsResponse & {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(json.error || "Unable to load pending rewards");
  }
  return json;
}

export async function fetchClaimProof(params: {
  wallet: string;
  campaignId: number;
  rewardId: string;
}): Promise<ClaimProofResponse> {
  const search = new URLSearchParams({
    wallet: params.wallet,
    campaignId: String(params.campaignId),
    rewardId: params.rewardId,
  });
  const response = await fetch(`/api/rewards/claim-proof?${search.toString()}`, {
    method: "GET",
    cache: "no-store",
  });
  const json = (await response.json()) as ClaimProofResponse & {
    error?: string;
  };
  if (!response.ok) {
    if (json.error === "proof_not_found") {
      throw new Error("No claim proof found for this reward.");
    }
    if (json.error === "already_claimed") {
      throw new Error("This reward was already claimed on-chain.");
    }
    throw new Error(json.error || "Unable to fetch claim proof");
  }
  return json;
}
