import type {
  CreateDraftTaskRequest,
  MiniAppTaskTarget,
  ParticipantStatus,
  ShareCastRewardEntry,
  Task2EarnEarnedRewards,
  Task2EarnParticipant,
  Task2EarnTask,
  TaskDetailPayload,
  TaskMarketplaceItem,
  TokenUsdPrices,
} from "@/lib/task2earn/types";
import type { ShareRewardsCampaign } from "@/lib/task2earn/share-rewards-display";
import { mapVerifyError } from "@/lib/task2earn/verification-ui";

export type TaskVerificationCheck = {
  type: string;
  status: "passed" | "failed" | "unsupported" | "ineligible";
  message: string;
};

export type FarcasterUserOption = {
  fid: number;
  username: string;
  displayName: string | null;
  pfpUrl: string | null;
};

export async function fetchMarketplaceTasks(): Promise<TaskMarketplaceItem[]> {
  const response = await fetch("/api/tasks", { cache: "no-store" });
  const json = (await response.json()) as {
    success?: boolean;
    tasks?: TaskMarketplaceItem[];
    error?: string;
  };
  if (!response.ok || !json.success) {
    throw new Error(json.error || "Unable to load tasks");
  }
  return json.tasks ?? [];
}

export async function fetchTaskDetail(
  taskId: string,
  wallet?: string,
): Promise<TaskDetailPayload> {
  const params = new URLSearchParams();
  if (wallet) {
    params.set("wallet", wallet);
  }
  const query = params.toString();
  const response = await fetch(
    `/api/tasks/${taskId}${query ? `?${query}` : ""}`,
    { cache: "no-store" },
  );
  const json = (await response.json()) as {
    success?: boolean;
    task?: TaskDetailPayload;
    error?: string;
  };
  if (response.status === 404) {
    throw new Error("task_not_found");
  }
  if (!response.ok || !json.success || !json.task) {
    throw new Error(json.error || "Unable to load task");
  }
  return json.task;
}

export async function joinTaskRequest(
  taskId: string,
  wallet: string,
): Promise<{ alreadyJoined: boolean; participant: Task2EarnParticipant }> {
  const response = await fetch(`/api/tasks/${taskId}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wallet }),
  });
  const json = (await response.json()) as {
    success?: boolean;
    alreadyJoined?: boolean;
    participant?: Task2EarnParticipant;
    error?: string;
  };
  if (!response.ok || !json.success || !json.participant) {
    throw new Error(json.error || "Unable to join task");
  }
  return {
    alreadyJoined: Boolean(json.alreadyJoined),
    participant: json.participant,
  };
}

export async function verifyTaskRequest(
  taskId: string,
  wallet: string,
): Promise<{
  eligible: boolean;
  participantStatus: ParticipantStatus | null;
  checks: TaskVerificationCheck[];
  error: string | null;
}> {
  const response = await fetch(`/api/tasks/${taskId}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wallet }),
  });

  let json: {
    success?: boolean;
    eligible?: boolean;
    participantStatus?: ParticipantStatus;
    checks?: TaskVerificationCheck[];
    error?: string;
  } = {};
  try {
    json = (await response.json()) as typeof json;
  } catch {
    return {
      eligible: false,
      participantStatus: null,
      checks: [],
      error: mapVerifyError("verify_failed", response.status),
    };
  }

  const checks = Array.isArray(json.checks) ? json.checks : [];
  const participantStatus =
    json.participantStatus === "joined" ||
    json.participantStatus === "verified" ||
    json.participantStatus === "rejected"
      ? json.participantStatus
      : null;

  if (!response.ok || json.success === false) {
    return {
      eligible: false,
      participantStatus,
      checks,
      error: mapVerifyError(json.error, response.status),
    };
  }

  if (typeof json.eligible !== "boolean") {
    return {
      eligible: false,
      participantStatus,
      checks,
      error: mapVerifyError("verify_failed", response.status),
    };
  }

  return {
    eligible: json.eligible,
    participantStatus,
    checks,
    error: null,
  };
}

export async function fetchTaskPrices(): Promise<TokenUsdPrices> {
  const response = await fetch("/api/tasks/prices", { cache: "no-store" });
  const json = (await response.json()) as {
    success?: boolean;
    prices?: TokenUsdPrices;
    error?: string;
  };
  if (!response.ok || !json.success || !json.prices) {
    throw new Error(json.error || "Unable to load prices");
  }
  return json.prices;
}

export async function searchFarcasterUsersRequest(
  query: string,
): Promise<FarcasterUserOption[]> {
  const params = new URLSearchParams({ q: query });
  let json: {
    success?: boolean;
    users?: FarcasterUserOption[];
    error?: string;
  } = {};
  const response = await fetch(`/api/tasks/search-users?${params}`, {
    cache: "no-store",
  });
  try {
    json = (await response.json()) as typeof json;
  } catch {
    throw new Error(
      `Unable to search Farcaster users (${response.status || "network"})`,
    );
  }
  if (!response.ok || json.success === false) {
    throw new Error(
      json.error || `Unable to search Farcaster users (${response.status})`,
    );
  }
  const users = Array.isArray(json.users) ? json.users : [];
  return users.filter((user): user is FarcasterUserOption => {
    const fid = typeof user.fid === "number" ? user.fid : Number(user.fid);
    return (
      Number.isInteger(fid) &&
      fid > 0 &&
      typeof user.username === "string" &&
      user.username.trim().length > 0
    );
  }).map((user) => ({
    ...user,
    fid: typeof user.fid === "number" ? user.fid : Number(user.fid),
  }));
}

export async function searchMiniAppsRequest(
  query: string,
): Promise<MiniAppTaskTarget[]> {
  const params = new URLSearchParams({ q: query });
  let json: {
    success?: boolean;
    apps?: MiniAppTaskTarget[];
    error?: string;
  } = {};
  const response = await fetch(`/api/tasks/search-mini-apps?${params}`, {
    cache: "no-store",
  });
  try {
    json = (await response.json()) as typeof json;
  } catch {
    throw new Error(
      `Unable to search Farcaster Mini Apps (${response.status || "network"})`,
    );
  }
  if (!response.ok || json.success === false) {
    throw new Error(
      json.error || `Unable to search Farcaster Mini Apps (${response.status})`,
    );
  }
  const apps = Array.isArray(json.apps) ? json.apps : [];
  return apps.filter((app): app is MiniAppTaskTarget => {
    return (
      app?.kind === "mini_app" &&
      typeof app.url === "string" &&
      app.url.startsWith("https://") &&
      typeof app.name === "string" &&
      app.name.trim().length > 0
    );
  });
}

export async function inspectMiniAppRequest(url: string): Promise<{
  urlInspected: boolean;
  openVerified: false;
  target: MiniAppTaskTarget | null;
  error?: string;
}> {
  const response = await fetch("/api/tasks/inspect-mini-app", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const json = (await response.json()) as {
    success?: boolean;
    urlInspected?: boolean;
    openVerified?: false;
    target?: MiniAppTaskTarget;
    error?: string;
  };
  if (!response.ok || !json.success) {
    return {
      urlInspected: false,
      openVerified: false,
      target: null,
      error: json.error || "Unable to inspect Mini App URL",
    };
  }
  return {
    urlInspected: Boolean(json.urlInspected),
    openVerified: false,
    target: json.target ?? null,
  };
}

export async function createDraftTaskRequest(
  payload: CreateDraftTaskRequest,
): Promise<{ task: Task2EarnTask; usdEstimateUnavailable: boolean }> {
  const response = await fetch("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await response.json()) as {
    success?: boolean;
    task?: Task2EarnTask;
    usdEstimateUnavailable?: boolean;
    error?: string;
    errors?: { field: string; message: string }[];
  };
  if (!response.ok || !json.success || !json.task) {
    const detail = json.errors?.[0]?.message;
    throw new Error(detail || json.error || "Unable to create draft");
  }
  return {
    task: json.task,
    usdEstimateUnavailable: Boolean(json.usdEstimateUnavailable),
  };
}

export type ShareCastRewardResponse = {
  alreadyCredited: boolean;
  amountBqr: number;
  earnedBqr: number;
  claimId: string;
  castHash: string | null;
  label: string;
};

export async function requestShareCastReward(
  taskId: string,
  wallet: string,
  castHash?: string | null,
): Promise<ShareCastRewardResponse> {
  const response = await fetch(`/api/tasks/${taskId}/share-reward`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      wallet,
      ...(castHash ? { castHash } : {}),
    }),
  });
  const json = (await response.json()) as {
    success?: boolean;
    alreadyCredited?: boolean;
    amountBqr?: number;
    earnedBqr?: number;
    claimId?: string;
    castHash?: string | null;
    label?: string;
    error?: string;
    reason?: string | null;
  };
  if (!response.ok || !json.success) {
    const detail = json.reason || json.error || "Unable to verify Share Cast";
    throw new Error(detail);
  }
  return {
    alreadyCredited: Boolean(json.alreadyCredited),
    amountBqr: Number(json.amountBqr) || 0,
    earnedBqr: Number(json.earnedBqr) || 0,
    claimId: json.claimId ?? "",
    castHash: json.castHash ?? null,
    label: json.label ?? "Task2Earn earned BQR (off-chain)",
  };
}

export async function fetchTask2EarnRewards(
  wallet: string,
): Promise<Task2EarnEarnedRewards> {
  const params = new URLSearchParams({ wallet });
  const response = await fetch(`/api/tasks/rewards?${params}`, {
    cache: "no-store",
  });
  const json = (await response.json()) as {
    success?: boolean;
    label?: Task2EarnEarnedRewards["label"];
    earnedBqr?: number;
    entries?: ShareCastRewardEntry[];
    error?: string;
  };
  if (!response.ok || !json.success) {
    throw new Error(json.error || "Unable to load Task2Earn earned BQR");
  }
  return {
    label: json.label ?? "Task2Earn earned BQR (off-chain)",
    earnedBqr: Number(json.earnedBqr) || 0,
    entries: Array.isArray(json.entries) ? json.entries : [],
  };
}

export async function fetchShareRewardsCampaign(
  wallet?: string | null,
): Promise<ShareRewardsCampaign> {
  const params = new URLSearchParams();
  if (wallet) {
    params.set("wallet", wallet);
  }
  const query = params.toString();
  const response = await fetch(
    `/api/tasks/share-rewards${query ? `?${query}` : ""}`,
    { cache: "no-store" },
  );
  const json = (await response.json()) as {
    success?: boolean;
    campaign?: ShareRewardsCampaign;
    error?: string;
  };
  if (!response.ok || !json.success || !json.campaign) {
    throw new Error(json.error || "Unable to load BQR Share Rewards");
  }
  return json.campaign;
}

export async function verifyDailyShareRewardRequest(
  wallet: string,
  castHash?: string | null,
): Promise<{
  alreadyClaimed: boolean;
  verified: boolean;
  campaign: ShareRewardsCampaign;
  castHash: string | null;
}> {
  const response = await fetch("/api/tasks/share-rewards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      wallet,
      ...(castHash ? { castHash } : {}),
    }),
  });
  const json = (await response.json()) as {
    success?: boolean;
    alreadyClaimed?: boolean;
    verified?: boolean;
    campaign?: ShareRewardsCampaign;
    castHash?: string | null;
    error?: string;
    reason?: string | null;
  };
  if (!response.ok || !json.success || !json.campaign) {
    throw new Error(json.reason || json.error || "Unable to verify share");
  }
  return {
    alreadyClaimed: Boolean(json.alreadyClaimed),
    verified: Boolean(json.verified),
    campaign: json.campaign,
    castHash: json.castHash ?? null,
  };
}
