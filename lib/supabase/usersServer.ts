import { mergeCompletedQuestsForDb } from "@/lib/quests/deployContractDailyReward";
import {
  getDefaultProgress,
  type QuestProgress,
} from "@/lib/quest-engine";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSupabaseError } from "@/lib/supabase/errors";
import {
  progressToUserUpdate,
  type UserRow,
  userRowToProgress,
} from "@/lib/supabase/users";
import { normalizeWalletAddress } from "@/lib/x/config";

/**
 * Server-only user progress writes (service role).
 * Never import from client components.
 */

function assertServer() {
  if (typeof window !== "undefined") {
    throw new Error("usersServer helpers are server-only");
  }
}

export async function fetchOrCreateUserAdmin(
  walletAddress: string,
): Promise<UserRow | null> {
  assertServer();
  const normalizedAddress = normalizeWalletAddress(walletAddress);
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    logSupabaseError(
      "fetchOrCreateUserAdmin",
      "client unavailable",
      new Error("Supabase admin client is not configured"),
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
    logSupabaseError("fetchOrCreateUserAdmin", "select", fetchError, {
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
    logSupabaseError("fetchOrCreateUserAdmin", "insert", createError, {
      walletAddress: normalizedAddress,
    });
    throw createError;
  }

  return createdUser as UserRow;
}

export async function saveUserProgressAdmin(
  walletAddress: string,
  progress: QuestProgress,
  options?: { completedQuestsOverride?: string[] },
): Promise<void> {
  assertServer();
  const normalizedAddress = normalizeWalletAddress(walletAddress);
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    const configError = new Error("Supabase admin client is not configured");
    logSupabaseError(
      "saveUserProgressAdmin",
      "client unavailable",
      configError,
      { walletAddress: normalizedAddress },
    );
    throw configError;
  }

  // Preserve deploy-contract:YYYY-MM-DD markers unless caller overrides.
  let completedQuests: string[] = progress.completedQuestIds;
  if (options?.completedQuestsOverride) {
    completedQuests = options.completedQuestsOverride;
  } else {
    const { data: current, error: readError } = await supabase
      .from("users")
      .select("completed_quests")
      .eq("wallet_address", normalizedAddress)
      .maybeSingle();

    if (readError) {
      logSupabaseError("saveUserProgressAdmin", "select markers", readError, {
        walletAddress: normalizedAddress,
      });
    } else {
      completedQuests = mergeCompletedQuestsForDb({
        questIds: progress.completedQuestIds,
        existingCompletedQuests: current?.completed_quests,
      });
    }
  }

  const update = {
    ...progressToUserUpdate(progress),
    completed_quests: completedQuests,
  };

  const { error } = await supabase
    .from("users")
    .update(update)
    .eq("wallet_address", normalizedAddress);

  if (error) {
    logSupabaseError("saveUserProgressAdmin", "update", error, {
      walletAddress: normalizedAddress,
    });
    throw error;
  }
}

export async function loadProgressAdmin(
  walletAddress: string,
): Promise<QuestProgress> {
  const user = await fetchOrCreateUserAdmin(walletAddress);
  return user ? userRowToProgress(user) : getDefaultProgress();
}
