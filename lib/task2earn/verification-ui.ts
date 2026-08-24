import type {
  AudienceRules,
  ParticipantStatus,
  TaskType,
} from "./types";

export const CHECK_SLOTS = [
  "follow",
  "like",
  "recast",
  "comment",
  "audience",
] as const;

export type CheckSlot = (typeof CHECK_SLOTS)[number];

export type CheckDisplayStatus =
  | "verified"
  | "not_verified"
  | "unable"
  | "not_required";

export type PublicCheck = {
  type: string;
  status: "passed" | "failed" | "unsupported" | "ineligible";
  message: string;
};

export type CheckDisplayRow = {
  slot: CheckSlot;
  label: string;
  status: CheckDisplayStatus | null;
  symbol: "✅" | "❌" | "⏳" | "—" | "";
  statusLabel: string;
  reason: string | null;
};

export type VerifyHeadline = {
  title: string;
  detail: string | null;
  tone: "idle" | "pending" | "success" | "failure" | "unavailable";
};

const SLOT_LABELS: Record<CheckSlot, string> = {
  follow: "Follow",
  like: "Like",
  recast: "Recast",
  comment: "Comment",
  audience: "Audience",
};

function hasAudienceRestrictions(rules: AudienceRules | null | undefined): boolean {
  if (!rules) {
    return false;
  }
  return (
    (typeof rules.minimum_followers === "number" && rules.minimum_followers > 0) ||
    (typeof rules.minimum_neynar_score === "number" && rules.minimum_neynar_score > 0) ||
    (typeof rules.minimum_account_age_days === "number" &&
      rules.minimum_account_age_days > 0) ||
    rules.non_spam_only === true ||
    rules.profile_photo_required === true
  );
}

const STATUS_META: Record<
  CheckDisplayStatus,
  { symbol: CheckDisplayRow["symbol"]; statusLabel: string }
> = {
  verified: { symbol: "✅", statusLabel: "Verified" },
  not_verified: { symbol: "❌", statusLabel: "Not verified" },
  unable: { symbol: "⏳", statusLabel: "Unable to verify" },
  not_required: { symbol: "—", statusLabel: "Not required" },
};

export function requiredActionSlots(
  taskType: TaskType,
): Array<Exclude<CheckSlot, "audience">> {
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
      return [];
  }
}

export function isActionSlotRequired(
  taskType: TaskType,
  slot: CheckSlot,
): boolean {
  if (slot === "audience") {
    return false;
  }
  return requiredActionSlots(taskType).includes(slot);
}

function checksForSlot(checks: PublicCheck[], slot: CheckSlot): PublicCheck[] {
  if (slot === "audience") {
    return checks.filter(
      (check) => check.type === "audience" || check.type.startsWith("audience."),
    );
  }
  return checks.filter((check) => check.type === slot);
}

export function audienceFailureReason(
  check: PublicCheck,
  rules: AudienceRules | null | undefined,
): string {
  if (check.type === "audience.followers") {
    const minimum = rules?.minimum_followers;
    return typeof minimum === "number" && minimum > 0
      ? `Minimum followers: ${minimum}+ required`
      : "Minimum followers required";
  }
  if (check.type === "audience.score") {
    return "Minimum Neynar Score required";
  }
  if (check.type === "audience.age") {
    const days = rules?.minimum_account_age_days;
    return typeof days === "number" && days > 0
      ? `Minimum account age: ${days}d required`
      : "Minimum account age required";
  }
  if (check.type === "audience.non_spam") {
    return "Non-spam accounts only";
  }
  if (check.type === "audience.photo") {
    return "Profile photo required";
  }
  return "Audience requirements not met";
}

function actionFailureReason(check: PublicCheck): string {
  if (check.type === "follow") {
    return "Not following the target account";
  }
  if (check.type === "like") {
    return "Has not liked the target cast";
  }
  if (check.type === "recast") {
    return "Has not recasted the target cast";
  }
  if (check.type === "comment") {
    return "No reply on the target cast was found";
  }
  return "Requirement not met";
}

function slotDisplayFromChecks(
  slot: CheckSlot,
  matched: PublicCheck[],
  rules: AudienceRules | null | undefined,
): { status: CheckDisplayStatus; reason: string | null } {
  if (matched.length === 0) {
    return { status: "unable", reason: "Unable to verify this requirement" };
  }

  if (matched.some((check) => check.status === "failed")) {
    const failed = matched.find((check) => check.status === "failed");
    return {
      status: "not_verified",
      reason: failed
        ? slot === "audience"
          ? audienceFailureReason(failed, rules)
          : actionFailureReason(failed)
        : "Requirement not met",
    };
  }

  if (matched.some((check) => check.status === "unsupported")) {
    return {
      status: "unable",
      reason:
        slot === "audience"
          ? "Audience could not be verified"
          : "This action cannot currently be verified server-side",
    };
  }

  if (matched.some((check) => check.status === "ineligible")) {
    return {
      status: "unable",
      reason: "A Farcaster-linked wallet is required to verify",
    };
  }

  if (matched.every((check) => check.status === "passed")) {
    return { status: "verified", reason: null };
  }

  return { status: "unable", reason: "Unable to verify this requirement" };
}

export function mapVerificationRows(params: {
  taskType: TaskType;
  audience: AudienceRules | null | undefined;
  checks: PublicCheck[] | null;
}): CheckDisplayRow[] {
  const audienceRequired = hasAudienceRestrictions(params.audience);

  return CHECK_SLOTS.map((slot) => {
    const required =
      slot === "audience"
        ? audienceRequired
        : isActionSlotRequired(params.taskType, slot);

    if (!required) {
      const meta = STATUS_META.not_required;
      return {
        slot,
        label: SLOT_LABELS[slot],
        status: "not_required",
        symbol: meta.symbol,
        statusLabel: meta.statusLabel,
        reason: null,
      };
    }

    if (!params.checks) {
      return {
        slot,
        label: SLOT_LABELS[slot],
        status: null,
        symbol: "",
        statusLabel: "Not checked yet",
        reason: null,
      };
    }

    const identity = params.checks.find((check) => check.type === "identity");
    if (identity && identity.status === "ineligible") {
      const meta = STATUS_META.unable;
      return {
        slot,
        label: SLOT_LABELS[slot],
        status: "unable",
        symbol: meta.symbol,
        statusLabel: meta.statusLabel,
        reason: "A Farcaster-linked wallet is required to verify",
      };
    }

    const provider = params.checks.find((check) => check.type === "provider");
    const matched = checksForSlot(params.checks, slot);
    const display =
      matched.length === 0 && provider
        ? {
            status: "unable" as const,
            reason: "Farcaster verification is temporarily unavailable",
          }
        : slotDisplayFromChecks(slot, matched, params.audience);
    const meta = STATUS_META[display.status];
    return {
      slot,
      label: SLOT_LABELS[slot],
      status: display.status,
      symbol: meta.symbol,
      statusLabel: meta.statusLabel,
      reason: display.status === "not_verified" || display.status === "unable"
        ? display.reason
        : null,
    };
  });
}

export function mapVerifyError(code: string | undefined, httpStatus?: number): string {
  switch (code) {
    case "valid_wallet_required":
      return "Connect a valid wallet to verify.";
    case "task_not_found":
      return "Task not found.";
    case "participant_not_found":
      return "Join this task before verifying.";
    case "task_not_verifiable":
      return "Verification unavailable.";
    case "task_misconfigured":
      return "This task cannot be verified because its target is incomplete.";
    case "unavailable":
      return "Farcaster verification is temporarily unavailable.";
    case "verify_failed":
      return "Verification failed. The task was not marked verified.";
    default:
      if (httpStatus === 503) {
        return "Farcaster verification is temporarily unavailable.";
      }
      return "Verification failed. The task was not marked verified.";
  }
}

export function mapJoinError(code: string | undefined): string {
  switch (code) {
    case "valid_wallet_required":
      return "Connect a valid wallet to join.";
    case "task_not_found":
      return "Task not found.";
    case "task_not_joinable":
      return "Drafts cannot be joined until the campaign is open.";
    case "task_ended":
      return "This campaign has ended.";
    case "task_full":
      return "This task is full.";
    case "farcaster_required":
      return "A Farcaster-linked wallet is required for this audience.";
    case "audience_ineligible":
      return "You do not meet this task's audience requirements.";
    case "unavailable":
      return "Joining is temporarily unavailable.";
    default:
      return code || "Join failed";
  }
}

export function participantStatusLabel(status: ParticipantStatus): string {
  if (status === "joined") {
    return "joined";
  }
  if (status === "verified") {
    return "verified";
  }
  return "rejected";
}

export function isSuccessfulVerification(params: {
  httpOk: boolean;
  eligible: boolean | undefined;
  error: string | null | undefined;
}): boolean {
  return (
    params.httpOk === true &&
    params.eligible === true &&
    !params.error
  );
}

export function resolveVerifyHeadline(params: {
  taskType: TaskType;
  verifying: boolean;
  attempted: boolean;
  eligible: boolean;
  error: string | null;
}): VerifyHeadline {
  if (params.taskType === "mini_app") {
    return {
      title: "Verification unavailable",
      detail:
        "Opening the Mini App cannot currently be verified server-side.",
      tone: "unavailable",
    };
  }
  if (params.verifying) {
    return {
      title: "Verifying...",
      detail: null,
      tone: "pending",
    };
  }
  if (params.error) {
    return {
      title: params.error,
      detail: "The task was not marked verified.",
      tone: params.error === "Verification unavailable." ? "unavailable" : "failure",
    };
  }
  if (params.attempted && params.eligible) {
    return {
      title: "Task verified",
      detail: null,
      tone: "success",
    };
  }
  if (params.attempted && !params.eligible) {
    return {
      title: "Task not completed yet",
      detail: null,
      tone: "failure",
    };
  }
  return {
    title: "Complete the task, then verify.",
    detail: null,
    tone: "idle",
  };
}
