import { calculatePendingRewards } from "@/lib/rewards/service";
import type {
  PendingRewardsResult,
  RewardEligibilityInput,
} from "@/lib/rewards/types";
import { parseQuestIds, type QuestId } from "@/lib/quest-engine";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { UserRow } from "@/lib/supabase/users";
import {
  isValidWalletAddress,
  normalizeWalletAddress,
} from "@/lib/x/config";

/**
 * Build eligibility inputs from existing user/referral data.
 * Read-only — does not modify XP, quests, or referrals.
 */

export type WalletEligibilitySnapshot = {
  wallet: string;
  input: RewardEligibilityInput;
  pending: PendingRewardsResult;
};

export async function loadSuccessfulReferralCountMap(): Promise<
  Map<string, number>
> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    throw new Error("Supabase admin client is not configured");
  }

  const { data, error } = await supabase
    .from("referrals")
    .select("referrer_wallet")
    .eq("status", "completed");

  if (error) {
    throw error;
  }

  const map = new Map<string, number>();
  for (const row of data ?? []) {
    const wallet = String(
      (row as { referrer_wallet: string }).referrer_wallet,
    ).toLowerCase();
    map.set(wallet, (map.get(wallet) ?? 0) + 1);
  }
  return map;
}

export async function listRewardUserWallets(): Promise<
  Array<{ wallet: string; completedQuestIds: QuestId[] }>
> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    throw new Error("Supabase admin client is not configured");
  }

  const { data, error } = await supabase
    .from("users")
    .select("wallet_address, completed_quests");

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => {
    const typed = row as Pick<UserRow, "wallet_address" | "completed_quests">;
    return {
      wallet: normalizeWalletAddress(String(typed.wallet_address)),
      completedQuestIds: parseQuestIds(typed.completed_quests),
    };
  });
}

/**
 * Eligibility for a single wallet, with claimed state supplied by caller
 * (from prior allocations / on-chain sync).
 */
export function evaluateWalletPending(params: {
  isWalletConnected: boolean;
  completedQuestIds: readonly QuestId[];
  successfulReferralCount: number;
  claimedActionIds: readonly string[];
  claimedReferralCount: number;
}): PendingRewardsResult {
  const input: RewardEligibilityInput = {
    isWalletConnected: params.isWalletConnected,
    completedQuestIds: params.completedQuestIds,
    successfulReferralCount: params.successfulReferralCount,
    claimedActionIds: params.claimedActionIds as RewardEligibilityInput["claimedActionIds"],
    claimedReferralCount: params.claimedReferralCount,
  };
  return calculatePendingRewards(input);
}

export async function loadWalletEligibilitySnapshot(params: {
  walletAddress: string;
  claimedActionIds: readonly string[];
  claimedReferralCount: number;
}): Promise<WalletEligibilitySnapshot> {
  if (!isValidWalletAddress(params.walletAddress)) {
    throw new Error("Invalid wallet address");
  }

  const wallet = normalizeWalletAddress(params.walletAddress);
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    throw new Error("Supabase admin client is not configured");
  }

  // Read-only: do not create users or mutate quest/referral rows.
  const { data: userRow, error: userError } = await supabase
    .from("users")
    .select("completed_quests")
    .eq("wallet_address", wallet)
    .maybeSingle();

  if (userError) {
    throw userError;
  }

  const completedQuestIds = parseQuestIds(
    (userRow as Pick<UserRow, "completed_quests"> | null)?.completed_quests ??
      [],
  );

  const { count, error } = await supabase
    .from("referrals")
    .select("id", { count: "exact", head: true })
    .eq("referrer_wallet", wallet)
    .eq("status", "completed");

  if (error) {
    throw error;
  }

  const successfulReferralCount = count ?? 0;
  const pending = evaluateWalletPending({
    isWalletConnected: true,
    completedQuestIds,
    successfulReferralCount,
    claimedActionIds: params.claimedActionIds,
    claimedReferralCount: params.claimedReferralCount,
  });

  return {
    wallet,
    input: {
      isWalletConnected: true,
      completedQuestIds,
      successfulReferralCount,
      claimedActionIds:
        params.claimedActionIds as RewardEligibilityInput["claimedActionIds"],
      claimedReferralCount: params.claimedReferralCount,
    },
    pending,
  };
}
