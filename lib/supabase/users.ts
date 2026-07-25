import {
  getDefaultProgress,
  normalizeCheckInDate,
  parseQuestIds,
  type QuestId,
  type QuestProgress,
} from "@/lib/quest-engine";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseClient } from "@/lib/supabase/client";
import { logSupabaseError } from "@/lib/supabase/errors";

/**
 * Expected Supabase table:
 *
 * create table users (
 *   id uuid primary key default gen_random_uuid(),
 *   wallet_address text unique not null,
 *   total_xp integer not null default 0,
 *   streak integer not null default 0,
 *   last_checkin date,
 *   completed_quests jsonb not null default '[]'::jsonb,
 *   x_user_id text,
 *   x_username text,
 *   twitter_user_id text,
 *   x_follow_verified_at timestamptz,
 *   created_at timestamptz not null default now(),
 *   updated_at timestamptz not null default now()
 * );
 *
 * alter table users add column if not exists x_user_id text;
 * alter table users add column if not exists x_username text;
 * alter table users add column if not exists twitter_user_id text;
 * alter table users add column if not exists x_follow_verified_at timestamptz;
 */
export type UserRow = {
  id: string;
  wallet_address: string;
  total_xp: number;
  streak: number;
  last_checkin: string | null;
  completed_quests: QuestId[] | string[] | null;
  x_user_id?: string | null;
  x_username?: string | null;
  twitter_user_id?: string | null;
  x_follow_verified_at?: string | null;
};

function normalizeWalletAddress(walletAddress: string) {
  return walletAddress.toLowerCase();
}

export function userRowToProgress(row: UserRow): QuestProgress {
  return {
    totalXp: row.total_xp ?? 0,
    streak: row.streak ?? 0,
    lastCheckInDate: normalizeCheckInDate(row.last_checkin),
    completedQuestIds: parseQuestIds(row.completed_quests),
  };
}

export function progressToUserUpdate(progress: QuestProgress) {
  return {
    total_xp: progress.totalXp,
    streak: progress.streak,
    last_checkin: progress.lastCheckInDate,
    completed_quests: progress.completedQuestIds,
    updated_at: new Date().toISOString(),
  };
}

export async function fetchOrCreateUser(
  walletAddress: string,
): Promise<UserRow | null> {
  const normalizedAddress = normalizeWalletAddress(walletAddress);

  const supabase = getSupabaseClient();
  if (!supabase) {
    logSupabaseError(
      "fetchOrCreateUser",
      "client unavailable",
      new Error("Supabase client is not configured"),
      { walletAddress: normalizedAddress },
    );
    return null;
  }

  const { data: existingUser, error: fetchError } = await supabase
    .from("users")
    .select("*")
    .eq("wallet_address", normalizedAddress)
    .maybeSingle();

  if (fetchError) {
    logSupabaseError("fetchOrCreateUser", "select", fetchError, {
      walletAddress: normalizedAddress,
    });
    throw fetchError;
  }

  if (existingUser) {
    return existingUser as UserRow;
  }

  const defaultProgress = getDefaultProgress();
  const { data: createdUser, error: createError } = await supabase
    .from("users")
    .insert({
      wallet_address: normalizedAddress,
      total_xp: defaultProgress.totalXp,
      streak: defaultProgress.streak,
      last_checkin: defaultProgress.lastCheckInDate,
      completed_quests: defaultProgress.completedQuestIds,
    })
    .select("*")
    .single();

  if (createError) {
    logSupabaseError("fetchOrCreateUser", "insert", createError, {
      walletAddress: normalizedAddress,
    });
    throw createError;
  }

  return createdUser as UserRow;
}

export async function saveUserProgress(
  walletAddress: string,
  progress: QuestProgress,
): Promise<void> {
  const normalizedAddress = normalizeWalletAddress(walletAddress);

  const supabase = getSupabaseClient();
  if (!supabase) {
    const configError = new Error("Supabase is not configured");
    logSupabaseError("saveUserProgress", "client unavailable", configError, {
      walletAddress: normalizedAddress,
    });
    throw configError;
  }

  const { error } = await supabase
    .from("users")
    .update(progressToUserUpdate(progress))
    .eq("wallet_address", normalizedAddress);

  if (error) {
    logSupabaseError("saveUserProgress", "update", error, {
      walletAddress: normalizedAddress,
    });
    throw error;
  }
}

export async function linkXAccountToWallet(
  walletAddress: string,
  account: { xUserId: string; xUsername: string },
): Promise<void> {
  const normalizedAddress = normalizeWalletAddress(walletAddress);

  // Ensure the user row exists before linking.
  await fetchOrCreateUser(normalizedAddress);

  const supabase = getSupabaseClient();
  if (!supabase) {
    const configError = new Error("Supabase is not configured");
    logSupabaseError("linkXAccountToWallet", "client unavailable", configError, {
      walletAddress: normalizedAddress,
    });
    throw configError;
  }

  const { error } = await supabase
    .from("users")
    .update({
      x_user_id: account.xUserId,
      x_username: account.xUsername,
      twitter_user_id: account.xUserId,
      updated_at: new Date().toISOString(),
    })
    .eq("wallet_address", normalizedAddress);

  if (error) {
    logSupabaseError("linkXAccountToWallet", "update", error, {
      walletAddress: normalizedAddress,
      xUserId: account.xUserId,
    });
    throw error;
  }
}

/**
 * Persist verified X follow (@bqrbase) for a wallet.
 * Stores twitter_user_id + verification timestamp.
 */
export async function saveXFollowVerification(
  walletAddress: string,
  account: {
    twitterUserId: string;
    xUsername: string;
    verifiedAt?: string;
  },
): Promise<void> {
  const normalizedAddress = normalizeWalletAddress(walletAddress);
  await fetchOrCreateUser(normalizedAddress);

  const usingAdmin = Boolean(getSupabaseAdminClient());
  const supabase = getSupabaseAdminClient() ?? getSupabaseClient();
  if (!supabase) {
    const configError = new Error("Supabase is not configured");
    logSupabaseError(
      "saveXFollowVerification",
      "client unavailable",
      configError,
      { walletAddress: normalizedAddress },
    );
    throw configError;
  }

  const verifiedAt = account.verifiedAt ?? new Date().toISOString();
  const updatePayload = {
    twitter_user_id: account.twitterUserId,
    x_user_id: account.twitterUserId,
    x_username: account.xUsername,
    x_follow_verified_at: verifiedAt,
    updated_at: verifiedAt,
  };
  const updateFilter = { wallet_address: normalizedAddress };
  const requestPath = "/rest/v1/users";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;

  const { data, error } = await supabase
    .from("users")
    .update(updatePayload)
    .eq("wallet_address", normalizedAddress)
    .select();

  console.error("[saveXFollowVerification] supabase update inspect", {
    supabaseUrl,
    requestPath,
    usingAdmin,
    updateFilter,
    updatePayloadKeys: Object.keys(updatePayload),
    responseData: data,
    responseError: error,
  });

  if (error) {
    logSupabaseError("saveXFollowVerification", "update", error, {
      walletAddress: normalizedAddress,
      twitterUserId: account.twitterUserId,
      supabaseUrl,
      requestPath,
      updateFilter,
      responseData: data,
    });
    throw error;
  }
}
