import type {
  AudienceRules,
  CampaignDuration,
  RewardToken,
  TaskStatus,
  TaskType,
  VerificationType,
} from "@/lib/task2earn/types";
import { calculateEqualSplitAmount } from "@/lib/task2earn/constants";

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  follow: "Follow",
  like: "Like",
  recast: "Recast",
  comment: "Comment",
  like_recast: "Like & Recast",
  like_recast_comment: "Like + Recast + Comment",
  bundle: "Bundle",
  mini_app: "Mini App",
};

export const TASK_TYPE_CREATE_LABELS: Record<TaskType, string> = {
  follow: "Follow Only",
  like: "Like Only",
  recast: "Recast Only",
  comment: "Comment Only",
  like_recast: "Like & Recast",
  like_recast_comment: "Like, Recast & Comment",
  bundle: "Bundle Task",
  mini_app: "Mini App",
};

export const TASK_TYPE_BADGE_CLASS: Record<TaskType, string> = {
  follow:
    "border-violet-400/45 bg-violet-500/20 text-violet-100 shadow-[0_0_12px_rgba(139,92,246,0.25)]",
  like:
    "border-pink-400/45 bg-pink-500/20 text-pink-100 shadow-[0_0_12px_rgba(236,72,153,0.25)]",
  recast:
    "border-cyan-400/45 bg-cyan-500/20 text-cyan-100 shadow-[0_0_12px_rgba(34,211,238,0.25)]",
  comment:
    "border-emerald-400/45 bg-emerald-500/20 text-emerald-100 shadow-[0_0_12px_rgba(16,185,129,0.25)]",
  like_recast:
    "border-indigo-400/40 bg-gradient-to-r from-blue-500/25 to-violet-500/25 text-sky-100",
  like_recast_comment:
    "border-white/20 bg-gradient-to-r from-pink-500/20 via-cyan-500/20 to-emerald-500/20 text-white",
  bundle:
    "border-orange-400/45 bg-gradient-to-r from-orange-500/25 to-pink-500/25 text-orange-100",
  mini_app:
    "border-cyan-400/40 bg-gradient-to-r from-cyan-500/25 to-violet-500/25 text-cyan-100",
};

export const REWARD_TOKEN_BADGE_CLASS: Record<RewardToken, string> = {
  BQR: "border-blue-400/45 bg-blue-500/20 text-blue-100",
  USDC: "border-emerald-400/45 bg-emerald-500/20 text-emerald-100",
  ETH: "border-violet-400/45 bg-violet-500/20 text-violet-100",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  draft: "Draft",
  open: "Open",
  active: "Active",
  ended: "Ended",
  cancelled: "Cancelled",
};

export const TASK_STATUS_BADGE_CLASS: Record<TaskStatus, string> = {
  draft: "border-white/15 bg-white/10 text-white/70",
  open: "border-cyan-400/40 bg-cyan-500/15 text-cyan-100",
  active: "border-emerald-400/40 bg-emerald-500/15 text-emerald-100",
  ended: "border-white/10 bg-white/5 text-white/50",
  cancelled: "border-rose-400/30 bg-rose-500/15 text-rose-100",
};

export const DURATION_LABELS: Record<CampaignDuration, string> = {
  1: "1 Day",
  2: "2 Days",
  3: "3 Days",
  7: "7 Days",
};

export const DURATION_CREATE_LABELS: Record<CampaignDuration, string> = {
  1: "⚡ 1 Day",
  2: "🔥 2 Days",
  3: "🌟 3 Days",
  7: "🌊 7 Days",
};

export const REQUIREMENT_LABELS: Record<
  Exclude<VerificationType, "share_cast" | "share_snap">,
  string
> = {
  follow: "Follow",
  like: "Like",
  recast: "Recast",
  comment: "Comment",
  mini_app: "Open Mini App",
};

export function getTaskRequirements(taskType: TaskType): VerificationType[] {
  switch (taskType) {
    case "follow":
      return ["follow"];
    case "like":
      return ["like"];
    case "recast":
      return ["recast"];
    case "comment":
      return ["comment"];
    case "like_recast":
      return ["like", "recast"];
    case "like_recast_comment":
      return ["like", "recast", "comment"];
    case "bundle":
      return ["follow", "like", "recast", "comment"];
    case "mini_app":
      return ["mini_app"];
  }
}

export type ActiveAudienceFilter = {
  key: keyof AudienceRules;
  label: string;
  value: string;
};

export function getActiveAudienceFilters(
  rules: AudienceRules | null | undefined,
): ActiveAudienceFilter[] {
  if (!rules) {
    return [];
  }

  const filters: ActiveAudienceFilter[] = [];

  if (
    typeof rules.minimum_followers === "number" &&
    rules.minimum_followers > 0
  ) {
    filters.push({
      key: "minimum_followers",
      label: "Minimum Followers",
      value: rules.minimum_followers.toLocaleString(),
    });
  }

  if (
    typeof rules.minimum_neynar_score === "number" &&
    rules.minimum_neynar_score > 0
  ) {
    filters.push({
      key: "minimum_neynar_score",
      label: "Minimum Neynar Score",
      value: String(rules.minimum_neynar_score),
    });
  }

  if (
    typeof rules.minimum_account_age_days === "number" &&
    rules.minimum_account_age_days > 0
  ) {
    filters.push({
      key: "minimum_account_age_days",
      label: "Minimum Account Age",
      value: `${rules.minimum_account_age_days}d`,
    });
  }

  if (rules.non_spam_only === true) {
    filters.push({
      key: "non_spam_only",
      label: "Non-Spam Only",
      value: "Required",
    });
  }

  if (rules.profile_photo_required === true) {
    filters.push({
      key: "profile_photo_required",
      label: "Profile Photo Required",
      value: "Required",
    });
  }

  return filters;
}

export function parseNumericAmount(value: string | number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatTokenAmount(
  value: string | number,
  token: RewardToken,
): string {
  const amount = parseNumericAmount(value);
  const formatted = amount.toLocaleString(undefined, {
    maximumFractionDigits: amount >= 1000 ? 2 : 6,
  });
  return `${formatted} ${token}`;
}

export function formatUsdAmount(value: string | number): string {
  const amount = parseNumericAmount(value);
  return `$${amount.toLocaleString(undefined, {
    minimumFractionDigits: amount < 10 ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

export function estimateRewardPerUser(
  poolAmount: string | number,
  verifiedCount: number,
): number | null {
  const pool = parseNumericAmount(poolAmount);
  const divisor = verifiedCount > 0 ? verifiedCount : 1;
  return calculateEqualSplitAmount(pool, divisor);
}

export function remainingTimeLabel(endsAtIso: string, now = Date.now()): string {
  const end = Date.parse(endsAtIso);
  if (!Number.isFinite(end)) {
    return "Unknown";
  }
  const delta = end - now;
  if (delta <= 0) {
    return "Ended";
  }
  const minutes = Math.floor(delta / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days >= 1) {
    return `${days}d ${hours % 24}h left`;
  }
  if (hours >= 1) {
    return `${hours}h ${minutes % 60}m left`;
  }
  return `${Math.max(1, minutes)}m left`;
}

export function isJoinableStatus(status: TaskStatus, endsAtIso: string): boolean {
  if (status !== "open" && status !== "active") {
    return false;
  }
  return Date.parse(endsAtIso) > Date.now();
}

export {
  joinedTaskSection,
  type JoinedTaskSection,
} from "./joined-section";
