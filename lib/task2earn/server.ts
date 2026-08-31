import {
  lookupFarcasterUserByFid,
  lookupFarcasterUserByUsername,
  lookupFidByWalletAddress,
  fetchUsersByFids,
} from "@/lib/farcaster/neynar";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSupabaseError } from "@/lib/supabase/errors";
import { T2E_TABLES, type T2eParticipantRow, type T2eTaskRow } from "@/lib/task2earn/db";
import { estimateRewardPerUser } from "@/lib/task2earn/display";
import {
  getCampaignRules,
  isCampaignDuration,
  isRewardToken,
  isTaskType,
  filterMarketplaceTasks,
  POOL_SPLIT_MODE,
  shouldShowTestTasksInMarketplace,
} from "@/lib/task2earn/constants";
import { inspectMiniAppUrl } from "@/lib/task2earn/mini-app";
import {
  estimatePoolUsd,
  feeTokenAmountFromUsd,
  fetchTokenUsdPrices,
} from "@/lib/task2earn/prices";
import {
  isPublicHttpsUrl,
  parseFarcasterCastUrl,
  parseTaskTarget,
} from "@/lib/task2earn/target";
import {
  sanitizeCreateDraftInput,
  type CreateDraftFieldError,
  type SanitizedCreateDraft,
} from "@/lib/task2earn/validate";
import {
  evaluateAudience,
  hasAudienceRestrictions,
  parseNeynarUserProfile,
} from "@/lib/task2earn/verification-logic";
import type {
  AudienceRules,
  CampaignDuration,
  CreateDraftTaskRequest,
  ParticipantStatus,
  PoolSplitMode,
  RewardToken,
  Task2EarnParticipant,
  Task2EarnTask,
  TaskDetailPayload,
  TaskMarketplaceItem,
  TaskStatus,
  TaskTarget,
  TaskType,
} from "@/lib/task2earn/types";

function numericString(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "0";
  }
  return String(value);
}

function asAudience(value: unknown): AudienceRules {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as AudienceRules;
}

function mapTaskRow(row: T2eTaskRow): Task2EarnTask | null {
  if (!isTaskType(row.task_type) || !isRewardToken(row.reward_token)) {
    return null;
  }
  const durationDays = Number(row.duration_days);
  if (!isCampaignDuration(durationDays)) {
    return null;
  }

  return {
    id: row.id,
    creatorWallet: row.creator_wallet,
    title: row.title,
    description: row.description ?? "",
    taskType: row.task_type as TaskType,
    rewardToken: row.reward_token as RewardToken,
    poolAmount: numericString(row.pool_amount),
    poolUsdValue: numericString(row.pool_usd_value),
    campaignFeeUsd: numericString(row.campaign_fee_usd),
    campaignFeeTokenAmount: numericString(row.campaign_fee_token_amount),
    durationDays: durationDays as CampaignDuration,
    splitMode: (row.split_mode ?? "equal") as PoolSplitMode,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status as TaskStatus,
    maxParticipants: row.max_participants,
    targetAudience: asAudience(row.target_audience),
    taskTarget: parseTaskTarget(row.task_target),
    shareCastEnabled: Boolean(row.share_cast_enabled),
    shareSnapEnabled: Boolean(row.share_snap_enabled),
    shareCastRewardBqr: numericString(row.share_cast_reward_bqr),
    shareSnapRewardBqr: numericString(row.share_snap_reward_bqr),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapParticipantRow(row: T2eParticipantRow): Task2EarnParticipant {
  return {
    id: row.id,
    taskId: row.task_id,
    walletAddress: row.wallet_address,
    fid: row.fid,
    status: row.status as ParticipantStatus,
    joinedAt: row.joined_at,
    verifiedAt: row.verified_at,
    rejectedAt: row.rejected_at,
    rejectionReason: row.rejection_reason,
  };
}

function withCounts(
  task: Task2EarnTask,
  participantCount: number,
  verifiedCount: number,
): TaskMarketplaceItem {
  const estimated = estimateRewardPerUser(task.poolAmount, verifiedCount);
  return {
    ...task,
    participantCount,
    verifiedCount,
    estimatedRewardPerUser:
      estimated === null ? null : String(estimated),
  };
}

function isMissingSchemaError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const code = "code" in error ? String(error.code) : "";
  const message = "message" in error ? String(error.message).toLowerCase() : "";
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    message.includes("t2e_tasks") ||
    message.includes("task_target") ||
    message.includes("does not exist") ||
    message.includes("schema cache")
  );
}

function requireAdmin() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    throw new Error("task2earn_unavailable");
  }
  return supabase;
}

const MARKETPLACE_STATUSES: TaskStatus[] = ["open", "active"];

export async function listMarketplaceTasks(): Promise<TaskMarketplaceItem[]> {
  const supabase = requireAdmin();

  const { data: taskRows, error: taskError } = await supabase
    .from(T2E_TABLES.tasks)
    .select("*")
    .in("status", MARKETPLACE_STATUSES)
    .order("created_at", { ascending: false });

  if (taskError) {
    if (isMissingSchemaError(taskError)) {
      return [];
    }
    logSupabaseError("listMarketplaceTasks", "select tasks", taskError);
    throw taskError;
  }

  const tasks = filterMarketplaceTasks(
    ((taskRows ?? []) as T2eTaskRow[])
      .map(mapTaskRow)
      .filter((task): task is Task2EarnTask => Boolean(task)),
    shouldShowTestTasksInMarketplace(),
  );

  if (tasks.length === 0) {
    return [];
  }

  const taskIds = tasks.map((task) => task.id);
  const { data: participantRows, error: participantError } = await supabase
    .from(T2E_TABLES.participants)
    .select("task_id, status")
    .in("task_id", taskIds);

  if (participantError) {
    logSupabaseError(
      "listMarketplaceTasks",
      "select participants",
      participantError,
    );
    throw participantError;
  }

  const counts = new Map<string, { total: number; verified: number }>();
  for (const row of participantRows ?? []) {
    const taskId = String((row as { task_id: string }).task_id);
    const current = counts.get(taskId) ?? { total: 0, verified: 0 };
    current.total += 1;
    if ((row as { status: string }).status === "verified") {
      current.verified += 1;
    }
    counts.set(taskId, current);
  }

  return tasks.map((task) => {
    const count = counts.get(task.id) ?? { total: 0, verified: 0 };
    return withCounts(task, count.total, count.verified);
  });
}

function participantStatusFromRow(status: string): ParticipantStatus {
  if (status === "verified" || status === "rejected") {
    return status;
  }
  return "joined";
}

/**
 * Tasks this wallet has joined, including ended campaigns.
 * Does not change the public marketplace list.
 */
export async function listJoinedTasks(
  walletAddress: string,
): Promise<TaskMarketplaceItem[]> {
  const supabase = requireAdmin();
  const wallet = walletAddress.toLowerCase();

  const { data: joinedRows, error: joinedError } = await supabase
    .from(T2E_TABLES.participants)
    .select("task_id, status, joined_at")
    .eq("wallet_address", wallet)
    .order("joined_at", { ascending: false });

  if (joinedError) {
    if (isMissingSchemaError(joinedError)) {
      return [];
    }
    logSupabaseError("listJoinedTasks", "select participants", joinedError, {
      wallet,
    });
    throw joinedError;
  }

  const statusByTask = new Map<string, ParticipantStatus>();
  const taskIds: string[] = [];
  for (const row of joinedRows ?? []) {
    const taskId = String((row as { task_id: string }).task_id);
    if (statusByTask.has(taskId)) {
      continue;
    }
    taskIds.push(taskId);
    statusByTask.set(
      taskId,
      participantStatusFromRow(String((row as { status: string }).status)),
    );
  }

  if (taskIds.length === 0) {
    return [];
  }

  const { data: taskRows, error: taskError } = await supabase
    .from(T2E_TABLES.tasks)
    .select("*")
    .in("id", taskIds);

  if (taskError) {
    if (isMissingSchemaError(taskError)) {
      return [];
    }
    logSupabaseError("listJoinedTasks", "select tasks", taskError, { wallet });
    throw taskError;
  }

  const tasks = ((taskRows ?? []) as T2eTaskRow[])
    .map(mapTaskRow)
    .filter((task): task is Task2EarnTask => Boolean(task));

  if (tasks.length === 0) {
    return [];
  }

  const listedIds = tasks.map((task) => task.id);
  const { data: participantRows, error: participantError } = await supabase
    .from(T2E_TABLES.participants)
    .select("task_id, status")
    .in("task_id", listedIds);

  if (participantError) {
    logSupabaseError(
      "listJoinedTasks",
      "select participant counts",
      participantError,
      { wallet },
    );
    throw participantError;
  }

  const counts = new Map<string, { total: number; verified: number }>();
  for (const row of participantRows ?? []) {
    const taskId = String((row as { task_id: string }).task_id);
    const current = counts.get(taskId) ?? { total: 0, verified: 0 };
    current.total += 1;
    if ((row as { status: string }).status === "verified") {
      current.verified += 1;
    }
    counts.set(taskId, current);
  }

  const joinOrder = new Map(taskIds.map((id, index) => [id, index]));
  return tasks
    .map((task) => {
      const count = counts.get(task.id) ?? { total: 0, verified: 0 };
      return {
        ...withCounts(task, count.total, count.verified),
        viewerParticipantStatus: statusByTask.get(task.id) ?? "joined",
      };
    })
    .sort(
      (left, right) =>
        (joinOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
        (joinOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER),
    );
}

export async function getMarketplaceTask(
  taskId: string,
  viewerWallet?: string,
): Promise<TaskDetailPayload | null> {
  const supabase = requireAdmin();

  const { data: taskRow, error: taskError } = await supabase
    .from(T2E_TABLES.tasks)
    .select("*")
    .eq("id", taskId)
    .maybeSingle();

  if (taskError) {
    if (isMissingSchemaError(taskError)) {
      return null;
    }
    logSupabaseError("getMarketplaceTask", "select task", taskError, { taskId });
    throw taskError;
  }
  if (!taskRow) {
    return null;
  }

  const task = mapTaskRow(taskRow as T2eTaskRow);
  if (!task) {
    return null;
  }

  const { data: participantRows, error: participantError } = await supabase
    .from(T2E_TABLES.participants)
    .select("*")
    .eq("task_id", taskId);

  if (participantError) {
    logSupabaseError("getMarketplaceTask", "select participants", participantError, {
      taskId,
    });
    throw participantError;
  }

  const participants = (participantRows ?? []) as T2eParticipantRow[];
  const verifiedCount = participants.filter((row) => row.status === "verified").length;
  const item = withCounts(task, participants.length, verifiedCount);

  const viewerParticipant = viewerWallet
    ? participants.find(
        (row) => row.wallet_address.toLowerCase() === viewerWallet.toLowerCase(),
      )
    : undefined;

  const atCapacity =
    task.maxParticipants !== null && participants.length >= task.maxParticipants;
  const joinable =
    (task.status === "open" || task.status === "active") &&
    Date.parse(task.endsAt) > Date.now() &&
    !atCapacity &&
    !viewerParticipant;

  return {
    ...item,
    joinable,
    viewerParticipant: viewerParticipant
      ? mapParticipantRow(viewerParticipant)
      : null,
  };
}

export type JoinTaskResult =
  | { ok: true; alreadyJoined: boolean; participant: Task2EarnParticipant }
  | { ok: false; error: string; status: number };

export async function joinTask(params: {
  taskId: string;
  walletAddress: string;
}): Promise<JoinTaskResult> {
  const supabase = requireAdmin();
  const task = await getMarketplaceTask(params.taskId, params.walletAddress);
  if (!task) {
    return { ok: false, error: "task_not_found", status: 404 };
  }

  if (task.viewerParticipant) {
    return {
      ok: true,
      alreadyJoined: true,
      participant: task.viewerParticipant,
    };
  }

  if (task.status !== "open" && task.status !== "active") {
    return { ok: false, error: "task_not_joinable", status: 409 };
  }
  if (Date.parse(task.endsAt) <= Date.now()) {
    return { ok: false, error: "task_ended", status: 409 };
  }
  if (
    task.maxParticipants !== null &&
    task.participantCount >= task.maxParticipants
  ) {
    return { ok: false, error: "task_full", status: 409 };
  }

  let fid: number | null = null;
  try {
    fid = await lookupFidByWalletAddress(params.walletAddress);
  } catch (error) {
    console.error("[task2earn] FID lookup failed during join", error);
  }

  if (hasAudienceRestrictions(task.targetAudience)) {
    if (!fid) {
      return {
        ok: false,
        error: "farcaster_required",
        status: 400,
      };
    }
    const profilePayload = await fetchUsersByFids([fid]);
    const profile = parseNeynarUserProfile(profilePayload, fid);
    const audience = evaluateAudience(profile, task.targetAudience);
    if (!audience.ok) {
      return {
        ok: false,
        error: "audience_ineligible",
        status: 403,
      };
    }
  }

  const { data, error } = await supabase
    .from(T2E_TABLES.participants)
    .insert({
      task_id: params.taskId,
      wallet_address: params.walletAddress,
      fid,
      status: "joined",
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      const existing = await getMarketplaceTask(
        params.taskId,
        params.walletAddress,
      );
      if (existing?.viewerParticipant) {
        return {
          ok: true,
          alreadyJoined: true,
          participant: existing.viewerParticipant,
        };
      }
    }
    logSupabaseError("joinTask", "insert participant", error, {
      taskId: params.taskId,
    });
    throw error;
  }

  return {
    ok: true,
    alreadyJoined: false,
    participant: mapParticipantRow(data as T2eParticipantRow),
  };
}

async function resolveTaskTarget(
  input: SanitizedCreateDraft,
): Promise<TaskTarget | { error: string }> {
  if (input.targetInput.kind === "cast") {
    const parsed = parseFarcasterCastUrl(input.targetInput.url ?? "");
    if (!parsed) {
      return { error: "Enter a valid Farcaster or Warpcast cast URL" };
    }
    return parsed;
  }

  if (input.targetInput.kind === "follow") {
    const username = input.targetInput.username ?? "";
    const requestedFid = input.targetInput.fid;
    if (!username) {
      return { error: "Select a Farcaster account to follow" };
    }
    try {
      if (typeof requestedFid === "number" && requestedFid > 0) {
        const byFid = await lookupFarcasterUserByFid(requestedFid);
        if (byFid) {
          return {
            kind: "follow",
            username: byFid.username,
            fid: byFid.fid,
            displayName: byFid.displayName,
          };
        }
      }
      const user = await lookupFarcasterUserByUsername(username);
      if (user) {
        return {
          kind: "follow",
          username: user.username,
          fid: user.fid,
          displayName: user.displayName,
        };
      }
    } catch (error) {
      console.error("[task2earn] follow account lookup failed", error);
      return { error: "Unable to resolve the selected Farcaster account. Try again." };
    }
    return { error: "Select a real Farcaster account from search results" };
  }

  const inspected = await inspectMiniAppUrl(input.targetInput.url ?? "");
  if (inspected.target) {
    return {
      ...inspected.target,
      name: input.targetInput.name || inspected.target.name,
    };
  }
  const fallbackUrl = isPublicHttpsUrl(input.targetInput.url ?? "");
  if (!fallbackUrl) {
    return { error: "Enter a public https Mini App URL" };
  }
  return {
    kind: "mini_app",
    name: input.targetInput.name || fallbackUrl.hostname,
    url: fallbackUrl.toString(),
    appId: null,
    metadata: {},
  };
}

export type CreateDraftTaskResult =
  | {
      ok: true;
      task: Task2EarnTask;
      usdEstimateUnavailable: boolean;
    }
  | {
      ok: false;
      error: string;
      status: number;
      errors?: CreateDraftFieldError[];
      minPoolUsd?: number;
    };

/**
 * Creates an off-chain draft only. No transfers, escrow, approvals, or on-chain status.
 * Creator is the wallet from the existing body-auth pattern — not a cryptographic session.
 */
export async function createDraftTask(params: {
  walletAddress: string;
  body: CreateDraftTaskRequest | Record<string, unknown>;
}): Promise<CreateDraftTaskResult> {
  const sanitized = sanitizeCreateDraftInput(params.body);
  if (!sanitized.ok) {
    return {
      ok: false,
      error: "invalid_task_config",
      status: 400,
      errors: sanitized.errors,
    };
  }

  const input = sanitized.value;
  const target = await resolveTaskTarget(input);
  if ("error" in target) {
    return {
      ok: false,
      error: "invalid_task_config",
      status: 400,
      errors: [{ field: "target", message: target.error }],
    };
  }

  const rules = getCampaignRules(input.durationDays);
  const prices = await fetchTokenUsdPrices();
  const poolUsd = estimatePoolUsd(
    input.rewardToken,
    input.poolAmountNumber,
    prices,
  );

  if (poolUsd !== null && poolUsd < rules.minPoolUsd) {
    return {
      ok: false,
      error: "pool_below_minimum",
      status: 400,
      minPoolUsd: rules.minPoolUsd,
      errors: [
        {
          field: "poolAmount",
          message: `Pool must be at least $${rules.minPoolUsd.toFixed(2)} USD for a ${input.durationDays}-day campaign`,
        },
      ],
    };
  }

  const startsAt = new Date();
  const endsAt = new Date(
    startsAt.getTime() + input.durationDays * 24 * 60 * 60 * 1000,
  );
  const feeTokenAmount = feeTokenAmountFromUsd(
    input.rewardToken,
    rules.feeUsd,
    prices,
  );

  const supabase = requireAdmin();
  const { data, error } = await supabase
    .from(T2E_TABLES.tasks)
    .insert({
      creator_wallet: params.walletAddress,
      title: input.title,
      description: input.description,
      task_type: input.taskType,
      reward_token: input.rewardToken,
      pool_amount: input.poolAmountNumber,
      pool_usd_value: poolUsd ?? 0,
      campaign_fee_usd: rules.feeUsd,
      campaign_fee_token_amount: feeTokenAmount,
      duration_days: input.durationDays,
      split_mode: POOL_SPLIT_MODE,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status: "draft",
      max_participants: input.maxParticipants,
      target_audience: input.audience,
      task_target: target,
      share_cast_enabled: input.shareCastEnabled,
      share_snap_enabled: input.shareSnapEnabled,
      share_cast_reward_bqr: 0,
      share_snap_reward_bqr: 0,
    })
    .select("*")
    .single();

  if (error) {
    if (isMissingSchemaError(error)) {
      return { ok: false, error: "unavailable", status: 503 };
    }
    logSupabaseError("createDraftTask", "insert task", error);
    throw error;
  }

  const task = mapTaskRow(data as T2eTaskRow);
  if (!task) {
    return { ok: false, error: "task_create_failed", status: 500 };
  }

  return {
    ok: true,
    task,
    usdEstimateUnavailable: poolUsd === null,
  };
}
