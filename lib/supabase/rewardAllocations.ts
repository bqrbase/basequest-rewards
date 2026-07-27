import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSupabaseError } from "@/lib/supabase/errors";
import { getPublishedCampaigns } from "@/lib/supabase/rewardCampaigns";
import type { Hex } from "viem";

/**
 * Expected table: reward_allocations
 * (supabase/migrations/20260726_add_reward_campaigns.sql)
 */

export type RewardAllocationRow = {
  id: string;
  campaign_id: string;
  wallet_address: string;
  action_key: string;
  reward_id: string;
  amount_bqr: string | number;
  amount_wei: string | number;
  leaf_hash: string | null;
  leaf_index: number | null;
  merkle_proof: string[];
  claimed_on_chain: boolean;
  claimed_synced_at: string | null;
  claim_tx_hash: string | null;
  created_at: string;
};

export type InsertRewardAllocation = {
  campaign_id: string;
  wallet_address: string;
  action_key: string;
  reward_id: Hex;
  amount_bqr: number;
  amount_wei: string;
  leaf_hash?: Hex | null;
  leaf_index?: number | null;
  merkle_proof?: Hex[];
};

function requireAdmin() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    throw new Error(
      "Supabase admin client is not configured (SUPABASE_SERVICE_ROLE_KEY)",
    );
  }
  return supabase;
}

export async function deleteAllocationsForCampaign(
  campaignId: string,
): Promise<void> {
  const supabase = requireAdmin();
  const { error } = await supabase
    .from("reward_allocations")
    .delete()
    .eq("campaign_id", campaignId);

  if (error) {
    logSupabaseError("deleteAllocationsForCampaign", "delete", error, {
      campaignId,
    });
    throw error;
  }
}

export async function insertRewardAllocations(
  rows: InsertRewardAllocation[],
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const supabase = requireAdmin();
  const payload = rows.map((row) => ({
    campaign_id: row.campaign_id,
    wallet_address: row.wallet_address.toLowerCase(),
    action_key: row.action_key,
    reward_id: row.reward_id.toLowerCase(),
    amount_bqr: row.amount_bqr,
    amount_wei: row.amount_wei,
    leaf_hash: row.leaf_hash?.toLowerCase() ?? null,
    leaf_index: row.leaf_index ?? null,
    merkle_proof: (row.merkle_proof ?? []).map((p) => p.toLowerCase()),
  }));

  const chunkSize = 500;
  for (let i = 0; i < payload.length; i += chunkSize) {
    const chunk = payload.slice(i, i + chunkSize);
    const { error } = await supabase.from("reward_allocations").insert(chunk);
    if (error) {
      logSupabaseError("insertRewardAllocations", "insert", error, {
        chunkStart: i,
        chunkSize: chunk.length,
      });
      throw error;
    }
  }
}

export async function listAllocationsForWallet(
  walletAddress: string,
  options?: { campaignId?: string; publishedOnly?: boolean },
): Promise<RewardAllocationRow[]> {
  const supabase = requireAdmin();

  if (options?.publishedOnly) {
    const published = await getPublishedCampaigns();
    const ids = published.map((c) => c.id);
    if (ids.length === 0) {
      return [];
    }

    let query = supabase
      .from("reward_allocations")
      .select("*")
      .eq("wallet_address", walletAddress.toLowerCase())
      .in("campaign_id", ids);

    if (options.campaignId) {
      query = query.eq("campaign_id", options.campaignId);
    }

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) {
      logSupabaseError("listAllocationsForWallet", "select", error, {
        walletAddress,
      });
      throw error;
    }

    return (data ?? []) as RewardAllocationRow[];
  }

  let query = supabase
    .from("reward_allocations")
    .select("*")
    .eq("wallet_address", walletAddress.toLowerCase());

  if (options?.campaignId) {
    query = query.eq("campaign_id", options.campaignId);
  }

  const { data, error } = await query.order("created_at", {
    ascending: false,
  });

  if (error) {
    logSupabaseError("listAllocationsForWallet", "select", error, {
      walletAddress,
    });
    throw error;
  }

  return (data ?? []) as RewardAllocationRow[];
}

export async function getAllocationByRewardId(params: {
  walletAddress: string;
  onChainCampaignId: number;
  rewardId: string;
}): Promise<
  | (RewardAllocationRow & {
      campaign: {
        id: string;
        status: string;
        on_chain_campaign_id: number | null;
        merkle_root: string | null;
      };
    })
  | null
> {
  const published = await getPublishedCampaigns();
  const campaign = published.find(
    (c) => c.on_chain_campaign_id === params.onChainCampaignId,
  );
  if (!campaign) {
    return null;
  }

  const supabase = requireAdmin();
  const { data, error } = await supabase
    .from("reward_allocations")
    .select("*")
    .eq("wallet_address", params.walletAddress.toLowerCase())
    .eq("reward_id", params.rewardId.toLowerCase())
    .eq("campaign_id", campaign.id)
    .maybeSingle();

  if (error) {
    logSupabaseError("getAllocationByRewardId", "select", error, params);
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    ...(data as RewardAllocationRow),
    campaign: {
      id: campaign.id,
      status: campaign.status,
      on_chain_campaign_id: campaign.on_chain_campaign_id,
      merkle_root: campaign.merkle_root,
    },
  };
}

export async function listAllocationsForCampaign(
  campaignId: string,
): Promise<RewardAllocationRow[]> {
  const supabase = requireAdmin();
  const { data, error } = await supabase
    .from("reward_allocations")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("leaf_index", { ascending: true });

  if (error) {
    logSupabaseError("listAllocationsForCampaign", "select", error, {
      campaignId,
    });
    throw error;
  }

  return (data ?? []) as RewardAllocationRow[];
}

export async function markAllocationClaimed(params: {
  allocationId: string;
  claimed: boolean;
  txHash?: string | null;
}): Promise<void> {
  const supabase = requireAdmin();
  const { error } = await supabase
    .from("reward_allocations")
    .update({
      claimed_on_chain: params.claimed,
      claimed_synced_at: new Date().toISOString(),
      claim_tx_hash: params.txHash?.toLowerCase() ?? null,
    })
    .eq("id", params.allocationId);

  if (error) {
    logSupabaseError("markAllocationClaimed", "update", error, params);
    throw error;
  }
}

export async function listPriorActionKeysForWallet(
  walletAddress: string,
): Promise<{ actionKeys: Set<string>; referralUnitMax: number }> {
  const supabase = requireAdmin();
  const { data: campaigns, error: campaignError } = await supabase
    .from("reward_campaigns")
    .select("id")
    .neq("status", "closed");

  if (campaignError) {
    logSupabaseError("listPriorActionKeysForWallet", "campaigns", campaignError);
    throw campaignError;
  }

  const campaignIds = (campaigns ?? []).map(
    (c) => (c as { id: string }).id,
  );
  if (campaignIds.length === 0) {
    return { actionKeys: new Set(), referralUnitMax: 0 };
  }

  const { data, error } = await supabase
    .from("reward_allocations")
    .select("action_key")
    .eq("wallet_address", walletAddress.toLowerCase())
    .in("campaign_id", campaignIds);

  if (error) {
    logSupabaseError("listPriorActionKeysForWallet", "select", error, {
      walletAddress,
    });
    throw error;
  }

  const actionKeys = new Set<string>();
  let referralUnitMax = 0;
  for (const row of data ?? []) {
    const key = String((row as { action_key: string }).action_key);
    actionKeys.add(key);
    const match = /^referral:(\d+)$/.exec(key);
    if (match) {
      referralUnitMax = Math.max(referralUnitMax, Number(match[1]));
    }
  }

  return { actionKeys, referralUnitMax };
}

export async function listAllPriorAllocationsSummary(): Promise<
  Map<string, { actionKeys: Set<string>; referralUnitMax: number }>
> {
  const supabase = requireAdmin();
  const { data: campaigns, error: campaignError } = await supabase
    .from("reward_campaigns")
    .select("id, status, leaf_count");

  if (campaignError) {
    logSupabaseError(
      "listAllPriorAllocationsSummary",
      "campaigns",
      campaignError,
    );
    throw campaignError;
  }

  // Only count allocations that are part of a committed snapshot/build.
  // Ignore closed campaigns and draft shells with no snapshotted leaf_count
  // (failed mid-snapshot rows must not permanently burn eligibility).
  const campaignIds = (campaigns ?? [])
    .filter((raw) => {
      const c = raw as {
        id: string;
        status: string;
        leaf_count: number | null;
      };
      if (c.status === "closed") return false;
      if (
        c.status === "snapshotted" ||
        c.status === "ready" ||
        c.status === "published"
      ) {
        return true;
      }
      // draft used as snapshotted fallback when DB lacks that status enum
      return c.status === "draft" && Number(c.leaf_count ?? 0) > 0;
    })
    .map((c) => (c as { id: string }).id);
  if (campaignIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from("reward_allocations")
    .select("wallet_address, action_key")
    .in("campaign_id", campaignIds);

  if (error) {
    logSupabaseError("listAllPriorAllocationsSummary", "select", error);
    throw error;
  }

  const map = new Map<
    string,
    { actionKeys: Set<string>; referralUnitMax: number }
  >();

  for (const row of data ?? []) {
    const wallet = String(
      (row as { wallet_address: string }).wallet_address,
    ).toLowerCase();
    const key = String((row as { action_key: string }).action_key);
    let entry = map.get(wallet);
    if (!entry) {
      entry = { actionKeys: new Set(), referralUnitMax: 0 };
      map.set(wallet, entry);
    }
    entry.actionKeys.add(key);
    const match = /^referral:(\d+)$/.exec(key);
    if (match) {
      entry.referralUnitMax = Math.max(
        entry.referralUnitMax,
        Number(match[1]),
      );
    }
  }

  return map;
}
