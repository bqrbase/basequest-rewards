import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSupabaseError } from "@/lib/supabase/errors";

/**
 * Expected tables: see supabase/migrations/20260726_add_reward_campaigns.sql
 * Server-only — service role client.
 */

export type RewardCampaignStatus =
  | "draft"
  | "snapshotted"
  | "ready"
  | "published"
  | "closed";

export type RewardCampaignRow = {
  id: string;
  name: string;
  description: string;
  status: RewardCampaignStatus;
  campaign_type: number;
  on_chain_campaign_id: number | null;
  merkle_root: string | null;
  start_time: number;
  end_time: number;
  leaf_count: number;
  total_amount_wei: string | number;
  bqr_decimals: number;
  build_error: string | null;
  created_at: string;
  updated_at: string;
  built_at: string | null;
  published_at: string | null;
};

export type CreateRewardCampaignInput = {
  name: string;
  description?: string;
  campaignType?: number;
  startTime?: number;
  endTime?: number;
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

export async function createRewardCampaign(
  input: CreateRewardCampaignInput,
): Promise<RewardCampaignRow> {
  const supabase = requireAdmin();
  const now = new Date().toISOString();
  const payload = {
    name: input.name.trim(),
    description: (input.description ?? "").trim(),
    status: "draft" as const,
    campaign_type: input.campaignType ?? 0,
    start_time: input.startTime ?? 0,
    end_time: input.endTime ?? 0,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("reward_campaigns")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    logSupabaseError("createRewardCampaign", "insert", error, payload);
    throw error;
  }

  return data as RewardCampaignRow;
}

export async function listRewardCampaigns(): Promise<RewardCampaignRow[]> {
  const supabase = requireAdmin();
  const { data, error } = await supabase
    .from("reward_campaigns")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    logSupabaseError("listRewardCampaigns", "select", error);
    throw error;
  }

  return (data ?? []) as RewardCampaignRow[];
}

export async function getRewardCampaign(
  id: string,
): Promise<RewardCampaignRow | null> {
  const supabase = requireAdmin();
  const { data, error } = await supabase
    .from("reward_campaigns")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    logSupabaseError("getRewardCampaign", "select", error, { id });
    throw error;
  }

  return (data as RewardCampaignRow) ?? null;
}

export async function getPublishedCampaigns(): Promise<RewardCampaignRow[]> {
  const supabase = requireAdmin();
  const { data, error } = await supabase
    .from("reward_campaigns")
    .select("*")
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (error) {
    logSupabaseError("getPublishedCampaigns", "select", error);
    throw error;
  }

  return (data ?? []) as RewardCampaignRow[];
}

export async function updateRewardCampaign(
  id: string,
  patch: Partial<{
    status: RewardCampaignStatus;
    on_chain_campaign_id: number | null;
    merkle_root: string | null;
    start_time: number;
    end_time: number;
    leaf_count: number;
    total_amount_wei: string;
    bqr_decimals: number;
    build_error: string | null;
    built_at: string | null;
    published_at: string | null;
    campaign_type: number;
    description: string;
    name: string;
  }>,
): Promise<RewardCampaignRow> {
  const supabase = requireAdmin();
  const { data, error } = await supabase
    .from("reward_campaigns")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    logSupabaseError("updateRewardCampaign", "update", error, { id, patch });
    throw error;
  }

  return data as RewardCampaignRow;
}
