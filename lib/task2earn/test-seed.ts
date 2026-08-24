/**
 * Off-chain Task2Earn verification test seed.
 * Creates no funds, payouts, claims, or escrow rows.
 * Must be invoked explicitly — never from app startup.
 */

import {
  lookupFarcasterUserByUsername,
} from "@/lib/farcaster/neynar";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSupabaseError } from "@/lib/supabase/errors";
import {
  T2E_TEST_CREATOR_WALLET,
  T2E_TEST_TASK_ID,
  T2E_TEST_TASK_TITLE,
} from "@/lib/task2earn/constants";
import { T2E_TABLES, type T2eTaskRow } from "@/lib/task2earn/db";
import { getMarketplaceTask } from "@/lib/task2earn/server";
import {
  isValidFarcasterUsername,
  normalizeFarcasterUsername,
} from "@/lib/task2earn/target";
import type { FollowTaskTarget, Task2EarnTask } from "@/lib/task2earn/types";

export type SeedTestTaskResult =
  | {
      ok: true;
      created: boolean;
      task: Task2EarnTask;
      followUsername: string;
      notice: string;
    }
  | { ok: false; error: string; status: number };

function requireAdmin() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    throw new Error("task2earn_unavailable");
  }
  return supabase;
}

export function resolveTestFollowUsername(bodyUsername?: string): string | null {
  const fromBody = bodyUsername?.trim() ?? "";
  const fromEnv = process.env.T2E_TEST_FOLLOW_USERNAME?.trim() ?? "";
  const raw = fromBody || fromEnv;
  if (!raw) {
    return null;
  }
  const username = normalizeFarcasterUsername(raw);
  return isValidFarcasterUsername(username) ? username : null;
}

async function resolveFollowTarget(
  username: string,
): Promise<FollowTaskTarget> {
  let fid: number | null = null;
  let displayName: string | null = null;
  try {
    const user = await lookupFarcasterUserByUsername(username);
    if (user) {
      fid = user.fid;
      displayName = user.displayName;
    }
  } catch (error) {
    console.error("[task2earn] test seed follow lookup failed", error);
  }
  return {
    kind: "follow",
    username,
    fid,
    displayName,
  };
}

function seedRow(target: FollowTaskTarget) {
  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + 7 * 24 * 60 * 60 * 1000);
  return {
    creator_wallet: T2E_TEST_CREATOR_WALLET,
    title: T2E_TEST_TASK_TITLE,
    description:
      "Off-chain Farcaster Follow verification test. Unfunded display-only pool. No escrow, claims, payouts, or token transfers.",
    task_type: "follow" as const,
    reward_token: "BQR" as const,
    pool_amount: 0,
    pool_usd_value: 0,
    campaign_fee_usd: 0,
    campaign_fee_token_amount: 0,
    duration_days: 7,
    split_mode: "equal",
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    status: "open" as const,
    max_participants: 50,
    target_audience: {},
    task_target: target,
    share_cast_enabled: false,
    share_snap_enabled: false,
    share_cast_reward_bqr: 0,
    share_snap_reward_bqr: 0,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Idempotent seed of ONE unfunded open Follow task.
 * Does not insert deposits, payouts, claims, or shares.
 */
export async function seedOpenUnfundedTestTask(params: {
  username?: string;
}): Promise<SeedTestTaskResult> {
  const username = resolveTestFollowUsername(params.username);
  if (!username) {
    return {
      ok: false,
      error:
        "Set T2E_TEST_FOLLOW_USERNAME or pass { username } for a real Farcaster account to follow.",
      status: 400,
    };
  }

  const supabase = requireAdmin();
  const target = await resolveFollowTarget(username);
  const row = seedRow(target);

  const { data: existing, error: existingError } = await supabase
    .from(T2E_TABLES.tasks)
    .select("id")
    .eq("title", T2E_TEST_TASK_TITLE)
    .maybeSingle();

  if (existingError) {
    logSupabaseError("seedOpenUnfundedTestTask", "lookup test task", existingError);
    throw existingError;
  }

  let taskId = T2E_TEST_TASK_ID;
  let created = false;

  if (existing?.id) {
    taskId = String(existing.id);
    const { error: updateError } = await supabase
      .from(T2E_TABLES.tasks)
      .update(row)
      .eq("id", taskId);
    if (updateError) {
      logSupabaseError("seedOpenUnfundedTestTask", "update test task", updateError);
      throw updateError;
    }
  } else {
    const { error: insertError } = await supabase.from(T2E_TABLES.tasks).insert({
      id: T2E_TEST_TASK_ID,
      ...row,
    });
    if (insertError) {
      logSupabaseError("seedOpenUnfundedTestTask", "insert test task", insertError);
      throw insertError;
    }
    created = true;
  }

  const task = await getMarketplaceTask(taskId);
  if (!task) {
    return { ok: false, error: "test_task_not_readable", status: 500 };
  }

  return {
    ok: true,
    created,
    task,
    followUsername: username,
    notice:
      "Unfunded open test task. Hidden from the marketplace unless T2E_SHOW_TEST_TASKS=true. No payouts or claims were created.",
  };
}

export async function findExistingTestTask(): Promise<Task2EarnTask | null> {
  const supabase = requireAdmin();
  const { data, error } = await supabase
    .from(T2E_TABLES.tasks)
    .select("*")
    .eq("title", T2E_TEST_TASK_TITLE)
    .maybeSingle();
  if (error) {
    logSupabaseError("findExistingTestTask", "select", error);
    throw error;
  }
  if (!data) {
    return null;
  }
  const mapped = await getMarketplaceTask(String((data as T2eTaskRow).id));
  return mapped;
}
