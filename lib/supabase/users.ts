import {
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
 *   twitter_user_id text,
 *   x_username text,
 *   x_follow_verified_at timestamptz,
 *   created_at timestamptz not null default now(),
 *   updated_at timestamptz not null default now()
 * );
 *
 * SECURITY: anon clients may SELECT only (RLS). All XP writes go through
 * service-role helpers in lib/supabase/usersServer.ts after wallet ownership.
 */
export type UserRow = {
  id: string;
  wallet_address: string;
  total_xp: number;
  streak: number;
  last_checkin: string | null;
  completed_quests: QuestId[] | string[] | null;
  twitter_user_id?: string | null;
  x_username?: string | null;
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

/**
 * Read-only fetch. Does not create rows (RLS blocks anon insert).
 * Prefer POST /api/progress/sync after wallet ownership for authoritative state.
 */
export async function fetchUser(
  walletAddress: string,
): Promise<UserRow | null> {
  const normalizedAddress = normalizeWalletAddress(walletAddress);

  const supabase = getSupabaseClient();
  if (!supabase) {
    logSupabaseError(
      "fetchUser",
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
    logSupabaseError("fetchUser", "select", fetchError, {
      walletAddress: normalizedAddress,
    });
    throw fetchError;
  }

  return (existingUser as UserRow | null) ?? null;
}

/**
 * @deprecated Client create/write path removed for security.
 * Server routes must use fetchOrCreateUserAdmin from usersServer.
 * Kept name for gradual migration — read-only wrapper.
 */
export async function fetchOrCreateUser(
  walletAddress: string,
): Promise<UserRow | null> {
  if (typeof window !== "undefined") {
    return fetchUser(walletAddress);
  }

  // Server callers should migrate to usersServer; temporary bridge.
  const { fetchOrCreateUserAdmin } = await import(
    "@/lib/supabase/usersServer"
  );
  return fetchOrCreateUserAdmin(walletAddress);
}

/**
 * @deprecated Client XP writes are forbidden.
 * Use awardOneTimeQuest / saveUserProgressAdmin on the server after ownership checks.
 */
export async function saveUserProgress(
  _walletAddress: string,
  _progress: QuestProgress,
): Promise<void> {
  const error = new Error(
    "Client XP writes are disabled. Persist progress via authenticated server APIs.",
  );
  logSupabaseError("saveUserProgress", "client_write_blocked", error, {});
  throw error;
}

export async function linkXAccountToWallet(
  walletAddress: string,
  account: { xUserId: string; xUsername: string },
): Promise<void> {
  const normalizedAddress = normalizeWalletAddress(walletAddress);
  const { fetchOrCreateUserAdmin } = await import(
    "@/lib/supabase/usersServer"
  );

  await fetchOrCreateUserAdmin(normalizedAddress);

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    throw new Error("Supabase is not configured");
  }

  const { error } = await supabase
    .from("users")
    .update({
      twitter_user_id: account.xUserId,
      x_username: account.xUsername,
      updated_at: new Date().toISOString(),
    })
    .eq("wallet_address", normalizedAddress);

  if (error) {
    logSupabaseError("linkXAccountToWallet", "update", error, {
      walletAddress: normalizedAddress,
      twitterUserId: account.xUserId,
    });
    throw error;
  }
}

/**
 * Persist verified X follow (@bqrbase) for a wallet (server-only).
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
  const { fetchOrCreateUserAdmin } = await import(
    "@/lib/supabase/usersServer"
  );
  await fetchOrCreateUserAdmin(normalizedAddress);

  const supabase = getSupabaseAdminClient();
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

  const { error } = await supabase
    .from("users")
    .update({
      twitter_user_id: account.twitterUserId,
      x_username: account.xUsername,
      x_follow_verified_at: verifiedAt,
      updated_at: verifiedAt,
    })
    .eq("wallet_address", normalizedAddress);

  if (error) {
    logSupabaseError("saveXFollowVerification", "update", error, {
      walletAddress: normalizedAddress,
      twitterUserId: account.twitterUserId,
    });
    throw error;
  }
}
