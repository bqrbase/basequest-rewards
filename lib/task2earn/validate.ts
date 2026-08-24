import {
  DESCRIPTION_MAX_LENGTH,
  isAccountAgeMinimum,
  isCampaignDuration,
  isFollowerMinimum,
  isRewardToken,
  isTaskType,
  MAX_PARTICIPANTS_CAP,
  TITLE_MAX_LENGTH,
  TITLE_MIN_LENGTH,
} from "@/lib/task2earn/constants";
import {
  isPublicHttpsUrl,
  isValidFarcasterUsername,
  needsCastTarget,
  needsFollowTarget,
  needsMiniAppTarget,
  normalizeFarcasterUsername,
  parseFarcasterCastUrl,
} from "@/lib/task2earn/target";
import type {
  AudienceRules,
  CampaignDuration,
  CreateDraftTaskRequest,
  RewardToken,
  TaskType,
} from "@/lib/task2earn/types";

export type CreateDraftFieldError = {
  field: string;
  message: string;
};

export type SanitizedCreateDraft = {
  taskType: TaskType;
  title: string;
  description: string;
  rewardToken: RewardToken;
  poolAmount: string;
  poolAmountNumber: number;
  durationDays: CampaignDuration;
  maxParticipants: number | null;
  audience: AudienceRules;
  targetInput: {
    kind: "cast" | "follow" | "mini_app";
    url?: string;
    username?: string;
    name?: string;
  };
  shareCastEnabled: boolean;
  shareSnapEnabled: boolean;
};

const POOL_AMOUNT_RE = /^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/;

export function sanitizeAudience(input: unknown): AudienceRules {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }
  const raw = input as Record<string, unknown>;
  const audience: AudienceRules = {};

  const followers = Number(raw.minimum_followers);
  if (isFollowerMinimum(followers)) {
    audience.minimum_followers = followers;
  }

  const score = Number(raw.minimum_neynar_score);
  if (Number.isFinite(score) && score > 0 && score <= 1) {
    audience.minimum_neynar_score = Math.round(score * 100) / 100;
  }

  const age = Number(raw.minimum_account_age_days);
  if (isAccountAgeMinimum(age)) {
    audience.minimum_account_age_days = age;
  }

  if (raw.non_spam_only === true) {
    audience.non_spam_only = true;
  }
  if (raw.profile_photo_required === true) {
    audience.profile_photo_required = true;
  }

  return audience;
}

export function parsePoolAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (!POOL_AMOUNT_RE.test(trimmed)) {
    return null;
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  return value;
}

export function validateTitle(raw: string): string | null {
  const title = raw.trim();
  if (title.length < TITLE_MIN_LENGTH) {
    return `Title must be at least ${TITLE_MIN_LENGTH} characters`;
  }
  if (title.length > TITLE_MAX_LENGTH) {
    return `Title must be at most ${TITLE_MAX_LENGTH} characters`;
  }
  return null;
}

export function validateDescription(raw: string): string | null {
  if (raw.trim().length > DESCRIPTION_MAX_LENGTH) {
    return `Description must be at most ${DESCRIPTION_MAX_LENGTH} characters`;
  }
  return null;
}

export function validateMaxParticipants(raw: string): number | null | { error: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  if (!/^\d+$/.test(trimmed)) {
    return { error: "Max participants must be a whole number" };
  }
  const value = Number(trimmed);
  if (!Number.isInteger(value) || value < 1) {
    return { error: "Max participants must be at least 1" };
  }
  if (value > MAX_PARTICIPANTS_CAP) {
    return { error: `Max participants cannot exceed ${MAX_PARTICIPANTS_CAP.toLocaleString()}` };
  }
  return value;
}

export function sanitizeCreateDraftInput(
  body: CreateDraftTaskRequest | Record<string, unknown>,
): { ok: true; value: SanitizedCreateDraft } | { ok: false; errors: CreateDraftFieldError[] } {
  const errors: CreateDraftFieldError[] = [];
  const raw = body as Record<string, unknown>;

  const taskTypeRaw = typeof raw.taskType === "string" ? raw.taskType : "";
  if (!isTaskType(taskTypeRaw)) {
    errors.push({ field: "taskType", message: "Select a valid task type" });
  }

  const title = typeof raw.title === "string" ? raw.title : "";
  const titleError = validateTitle(title);
  if (titleError) {
    errors.push({ field: "title", message: titleError });
  }

  const description = typeof raw.description === "string" ? raw.description : "";
  const descriptionError = validateDescription(description);
  if (descriptionError) {
    errors.push({ field: "description", message: descriptionError });
  }

  const rewardTokenRaw = typeof raw.rewardToken === "string" ? raw.rewardToken : "";
  if (!isRewardToken(rewardTokenRaw)) {
    errors.push({ field: "rewardToken", message: "Select BQR, USDC, or ETH" });
  }

  const poolRaw = typeof raw.poolAmount === "string" ? raw.poolAmount : String(raw.poolAmount ?? "");
  const poolAmountNumber = parsePoolAmount(poolRaw);
  if (poolAmountNumber === null) {
    errors.push({ field: "poolAmount", message: "Enter a pool amount greater than 0" });
  }

  const durationRaw = Number(raw.durationDays);
  if (!isCampaignDuration(durationRaw)) {
    errors.push({ field: "durationDays", message: "Duration must be 1, 2, 3, or 7 days" });
  }

  let maxParticipants: number | null = null;
  if (raw.maxParticipants !== undefined && raw.maxParticipants !== null && raw.maxParticipants !== "") {
    const parsed = validateMaxParticipants(String(raw.maxParticipants));
    if (parsed && typeof parsed === "object" && "error" in parsed) {
      errors.push({ field: "maxParticipants", message: parsed.error });
    } else {
      maxParticipants = parsed;
    }
  }

  const audience = sanitizeAudience(raw.audience);
  const targetRaw =
    raw.target && typeof raw.target === "object" && !Array.isArray(raw.target)
      ? (raw.target as Record<string, unknown>)
      : {};

  if (isTaskType(taskTypeRaw)) {
    if (needsCastTarget(taskTypeRaw)) {
      const url = typeof targetRaw.url === "string" ? targetRaw.url : "";
      if (!parseFarcasterCastUrl(url)) {
        errors.push({
          field: "target",
          message: "Enter a valid Farcaster or Warpcast cast URL",
        });
      }
    } else if (needsFollowTarget(taskTypeRaw)) {
      const username =
        typeof targetRaw.username === "string" ? targetRaw.username : "";
      if (!isValidFarcasterUsername(username)) {
        errors.push({
          field: "target",
          message: "Enter a Farcaster username to follow",
        });
      }
    } else if (needsMiniAppTarget(taskTypeRaw)) {
      const url = typeof targetRaw.url === "string" ? targetRaw.url : "";
      if (!isPublicHttpsUrl(url)) {
        errors.push({
          field: "target",
          message: "Enter a public https Mini App URL",
        });
      }
    }
  }

  if (errors.length > 0 || !isTaskType(taskTypeRaw) || !isRewardToken(rewardTokenRaw) || poolAmountNumber === null || !isCampaignDuration(durationRaw)) {
    return { ok: false, errors };
  }

  const kind = needsFollowTarget(taskTypeRaw)
    ? "follow"
    : needsMiniAppTarget(taskTypeRaw)
      ? "mini_app"
      : "cast";

  return {
    ok: true,
    value: {
      taskType: taskTypeRaw,
      title: title.trim(),
      description: description.trim(),
      rewardToken: rewardTokenRaw,
      poolAmount: poolRaw.trim(),
      poolAmountNumber,
      durationDays: durationRaw,
      maxParticipants,
      audience,
      targetInput: {
        kind,
        url: typeof targetRaw.url === "string" ? targetRaw.url.trim() : undefined,
        username: typeof targetRaw.username === "string"
          ? normalizeFarcasterUsername(targetRaw.username)
          : undefined,
        name: typeof targetRaw.name === "string" ? targetRaw.name.trim() : undefined,
      },
      shareCastEnabled: raw.shareCastEnabled !== false,
      shareSnapEnabled: raw.shareSnapEnabled !== false,
    },
  };
}
