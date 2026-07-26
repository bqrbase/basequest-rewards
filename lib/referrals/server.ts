import {
  generateReferralCode,
  isValidReferralCode,
  normalizeReferralCode,
} from "@/lib/referrals/codes";
import {
  REFERRAL_ONBOARDING_QUEST_ID,
  REFERRAL_REWARD_XP,
} from "@/lib/referrals/constants";
import { buildReferralLink } from "@/lib/referrals/storage";
import type {
  ReferralCodeRow,
  ReferralDashboard,
  ReferralLeaderboardEntry,
  ReferralRow,
  ReferralStats,
} from "@/lib/referrals/types";
import { parseQuestIds } from "@/lib/quest-engine";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSupabaseError } from "@/lib/supabase/errors";
import {
  fetchOrCreateUser,
  userRowToProgress,
} from "@/lib/supabase/users";
import {
  isValidWalletAddress,
  normalizeWalletAddress,
} from "@/lib/x/config";

function getAdminOrThrow(context: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    const error = new Error("Supabase admin is not configured");
    logSupabaseError(context, "admin unavailable", error);
    throw error;
  }
  return supabase;
}

export async function getOrCreateReferralCode(
  walletAddress: string,
): Promise<ReferralCodeRow> {
  const wallet = normalizeWalletAddress(walletAddress);
  const supabase = getAdminOrThrow("getOrCreateReferralCode");

  const { data: existing, error: selectError } = await supabase
    .from("referral_codes")
    .select("*")
    .eq("wallet_address", wallet)
    .maybeSingle();

  if (selectError) {
    logSupabaseError("getOrCreateReferralCode", "select", selectError, {
      walletAddress: wallet,
    });
    throw selectError;
  }

  if (existing) {
    return existing as ReferralCodeRow;
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateReferralCode(
      attempt === 0 ? wallet : `${wallet}:${attempt}:${Date.now()}`,
    );

    const { data: created, error: insertError } = await supabase
      .from("referral_codes")
      .insert({
        wallet_address: wallet,
        code,
      })
      .select("*")
      .single();

    if (!insertError && created) {
      return created as ReferralCodeRow;
    }

    // Unique wallet race — re-read.
    if (insertError?.code === "23505") {
      const { data: raced } = await supabase
        .from("referral_codes")
        .select("*")
        .eq("wallet_address", wallet)
        .maybeSingle();
      if (raced) {
        return raced as ReferralCodeRow;
      }
      continue;
    }

    logSupabaseError("getOrCreateReferralCode", "insert", insertError, {
      walletAddress: wallet,
      code,
    });
    throw insertError;
  }

  throw new Error("Unable to allocate referral code");
}

export async function getReferralStats(
  referrerWallet: string,
): Promise<ReferralStats> {
  const wallet = normalizeWalletAddress(referrerWallet);
  const supabase = getAdminOrThrow("getReferralStats");

  const { data, error } = await supabase
    .from("referrals")
    .select("status, reward_xp")
    .eq("referrer_wallet", wallet);

  if (error) {
    logSupabaseError("getReferralStats", "select", error, {
      walletAddress: wallet,
    });
    throw error;
  }

  const rows = (data ?? []) as Array<{ status: string; reward_xp: number }>;
  const successfulReferrals = rows.filter((row) => row.status === "completed")
    .length;
  const pendingReferrals = rows.filter((row) => row.status === "pending").length;
  const totalReferralXp = rows
    .filter((row) => row.status === "completed")
    .reduce((sum, row) => sum + (row.reward_xp ?? 0), 0);

  return {
    totalReferrals: rows.length,
    successfulReferrals,
    pendingReferrals,
    totalReferralXp,
  };
}

export async function getReferralDashboard(
  walletAddress: string,
  origin: string,
): Promise<ReferralDashboard> {
  const codeRow = await getOrCreateReferralCode(walletAddress);
  const stats = await getReferralStats(walletAddress);
  return {
    code: codeRow.code,
    link: buildReferralLink(origin, codeRow.code),
    stats,
  };
}

export type AttributeReferralResult =
  | { ok: true; status: "pending" | "already_pending" | "already_completed" }
  | {
      ok: false;
      error:
        | "invalid_code"
        | "invalid_wallet"
        | "self_referral"
        | "code_not_found"
        | "already_referred"
        | "server_error";
    };

/**
 * Bind a referee wallet to a referrer code as pending.
 * Does not award XP — that happens after onboarding.
 */
export async function attributeReferral(params: {
  refereeWallet: string;
  code: string;
}): Promise<AttributeReferralResult> {
  if (!isValidWalletAddress(params.refereeWallet)) {
    return { ok: false, error: "invalid_wallet" };
  }
  if (!isValidReferralCode(params.code)) {
    return { ok: false, error: "invalid_code" };
  }

  const referee = normalizeWalletAddress(params.refereeWallet);
  const code = normalizeReferralCode(params.code);
  const supabase = getAdminOrThrow("attributeReferral");

  // Ensure referee user row exists (wallet connected).
  await fetchOrCreateUser(referee);

  const { data: codeRow, error: codeError } = await supabase
    .from("referral_codes")
    .select("*")
    .eq("code", code)
    .maybeSingle();

  if (codeError) {
    logSupabaseError("attributeReferral", "select code", codeError, { code });
    return { ok: false, error: "server_error" };
  }

  if (!codeRow) {
    return { ok: false, error: "code_not_found" };
  }

  const referrer = normalizeWalletAddress(
    (codeRow as ReferralCodeRow).wallet_address,
  );

  if (referrer === referee) {
    return { ok: false, error: "self_referral" };
  }

  const { data: existing, error: existingError } = await supabase
    .from("referrals")
    .select("*")
    .eq("referee_wallet", referee)
    .maybeSingle();

  if (existingError) {
    logSupabaseError("attributeReferral", "select referral", existingError, {
      referee,
    });
    return { ok: false, error: "server_error" };
  }

  if (existing) {
    const row = existing as ReferralRow;
    return {
      ok: true,
      status: row.status === "completed" ? "already_completed" : "already_pending",
    };
  }

  // If referee already finished onboarding before attribution, still allow
  // pending row — completeReferral will finalize immediately after.
  const { error: insertError } = await supabase.from("referrals").insert({
    referrer_wallet: referrer,
    referee_wallet: referee,
    referral_code: code,
    status: "pending",
    reward_xp: 0,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return { ok: true, status: "already_pending" };
    }
    logSupabaseError("attributeReferral", "insert", insertError, {
      referrer,
      referee,
      code,
    });
    return { ok: false, error: "server_error" };
  }

  return { ok: true, status: "pending" };
}

export type CompleteReferralResult =
  | {
      ok: true;
      status: "completed" | "already_completed" | "pending" | "not_referred";
      rewardXp?: number;
    }
  | { ok: false; error: "invalid_wallet" | "server_error" };

async function awardReferrerXp(
  referrerWallet: string,
  rewardXp: number,
): Promise<void> {
  const supabase = getAdminOrThrow("awardReferrerXp");
  const wallet = normalizeWalletAddress(referrerWallet);

  const { data: user, error: selectError } = await supabase
    .from("users")
    .select("total_xp")
    .eq("wallet_address", wallet)
    .maybeSingle();

  if (selectError) {
    logSupabaseError("awardReferrerXp", "select", selectError, {
      walletAddress: wallet,
    });
    throw selectError;
  }

  if (!user) {
    await fetchOrCreateUser(wallet);
  }

  const currentXp =
    typeof user?.total_xp === "number" ? user.total_xp : 0;

  const { error: updateError } = await supabase
    .from("users")
    .update({
      total_xp: currentXp + rewardXp,
      updated_at: new Date().toISOString(),
    })
    .eq("wallet_address", wallet);

  if (updateError) {
    logSupabaseError("awardReferrerXp", "update", updateError, {
      walletAddress: wallet,
      rewardXp,
    });
    throw updateError;
  }
}

/**
 * Complete a pending referral after the referee finishes onboarding
 * (daily-check-in in completed_quests). Awards XP once.
 */
export async function completeReferralForReferee(
  refereeWallet: string,
): Promise<CompleteReferralResult> {
  if (!isValidWalletAddress(refereeWallet)) {
    return { ok: false, error: "invalid_wallet" };
  }

  const referee = normalizeWalletAddress(refereeWallet);
  const supabase = getAdminOrThrow("completeReferralForReferee");

  const { data: referral, error: referralError } = await supabase
    .from("referrals")
    .select("*")
    .eq("referee_wallet", referee)
    .maybeSingle();

  if (referralError) {
    logSupabaseError("completeReferralForReferee", "select", referralError, {
      referee,
    });
    return { ok: false, error: "server_error" };
  }

  if (!referral) {
    return { ok: true, status: "not_referred" };
  }

  const row = referral as ReferralRow;
  if (row.status === "completed") {
    return { ok: true, status: "already_completed", rewardXp: row.reward_xp };
  }

  const user = await fetchOrCreateUser(referee);
  if (!user) {
    return { ok: true, status: "pending" };
  }

  const progress = userRowToProgress(user);
  const completedIds = parseQuestIds(progress.completedQuestIds);
  if (!completedIds.includes(REFERRAL_ONBOARDING_QUEST_ID)) {
    return { ok: true, status: "pending" };
  }

  const now = new Date().toISOString();

  const { data: updated, error: updateError } = await supabase
    .from("referrals")
    .update({
      status: "completed",
      reward_xp: REFERRAL_REWARD_XP,
      completed_at: now,
      rewarded_at: now,
    })
    .eq("id", row.id)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();

  if (updateError) {
    logSupabaseError("completeReferralForReferee", "update", updateError, {
      referralId: row.id,
    });
    return { ok: false, error: "server_error" };
  }

  if (!updated) {
    // Lost the race — already completed by another request.
    return { ok: true, status: "already_completed", rewardXp: REFERRAL_REWARD_XP };
  }

  try {
    await awardReferrerXp(row.referrer_wallet, REFERRAL_REWARD_XP);
  } catch (awardError) {
    // Roll status back to pending so a retry can re-award.
    await supabase
      .from("referrals")
      .update({
        status: "pending",
        reward_xp: 0,
        completed_at: null,
        rewarded_at: null,
      })
      .eq("id", row.id);
    logSupabaseError(
      "completeReferralForReferee",
      "award failed",
      awardError,
      { referrer: row.referrer_wallet, referee },
    );
    return { ok: false, error: "server_error" };
  }

  return { ok: true, status: "completed", rewardXp: REFERRAL_REWARD_XP };
}

export async function getTopReferrers(
  limit = 50,
): Promise<ReferralLeaderboardEntry[]> {
  const supabase = getAdminOrThrow("getTopReferrers");

  const { data, error } = await supabase
    .from("referrals")
    .select("referrer_wallet, reward_xp, status")
    .eq("status", "completed");

  if (error) {
    logSupabaseError("getTopReferrers", "select", error);
    throw error;
  }

  const totals = new Map<
    string,
    { successful_referrals: number; total_referral_xp: number }
  >();

  for (const row of data ?? []) {
    const wallet = normalizeWalletAddress(
      String((row as { referrer_wallet: string }).referrer_wallet),
    );
    const reward = Number((row as { reward_xp: number }).reward_xp) || 0;
    const current = totals.get(wallet) ?? {
      successful_referrals: 0,
      total_referral_xp: 0,
    };
    current.successful_referrals += 1;
    current.total_referral_xp += reward;
    totals.set(wallet, current);
  }

  return [...totals.entries()]
    .map(([wallet_address, stats]) => ({
      wallet_address,
      successful_referrals: stats.successful_referrals,
      total_referral_xp: stats.total_referral_xp,
    }))
    .sort((a, b) => {
      if (b.successful_referrals !== a.successful_referrals) {
        return b.successful_referrals - a.successful_referrals;
      }
      return b.total_referral_xp - a.total_referral_xp;
    })
    .slice(0, limit);
}
