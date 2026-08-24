import type { AudienceRules } from "./types";

export const NON_SPAM_MIN_SCORE = 0.5;
export const MAX_REPLY_PAGES = 6;

export type CheckStatus = "passed" | "failed" | "unsupported" | "ineligible";

export type VerificationCheck = {
  type: string;
  status: CheckStatus;
  message: string;
};

export type ParsedCastLookup = {
  hash: string;
  url: string | null;
  authorFid: number;
  liked: boolean;
  recasted: boolean;
};

export type ParsedReply = {
  hash: string;
  authorFid: number;
  parentHashes: string[];
  parentUrls: string[];
};

export type ParsedUserProfile = {
  fid: number;
  followerCount: number;
  score: number | null;
  scoreSource: "score" | "experimental.neynar_user_score" | null;
  registeredAt: string | null;
  pfpUrl: string | null;
};

export type AudienceCheckResult = {
  ok: boolean;
  checks: VerificationCheck[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export function normalizeCastHash(raw: string | null | undefined): string {
  if (!raw) {
    return "";
  }
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) {
    return "";
  }
  return trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
}

export function isFullCastHash(raw: string | null | undefined): boolean {
  return /^0x[a-f0-9]{40}$/.test(normalizeCastHash(raw));
}

/**
 * Full hashes must match exactly. Truncated hashes may prefix a canonical hash.
 */
export function hashesReferToSameCast(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const a = normalizeCastHash(left).replace(/^0x/, "");
  const b = normalizeCastHash(right).replace(/^0x/, "");
  if (!a || !b || a.length < 8 || b.length < 8) {
    return false;
  }
  if (a === b) {
    return true;
  }
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  return longer.startsWith(shorter);
}

function collectString(value: unknown, into: string[]) {
  if (typeof value === "string" && value.trim()) {
    into.push(value.trim());
  }
}

export function extractReplyParents(reply: unknown): {
  hashes: string[];
  urls: string[];
} {
  const record = asRecord(reply);
  const hashes: string[] = [];
  const urls: string[] = [];
  if (!record) {
    return { hashes, urls };
  }

  collectString(record.parent_hash, hashes);
  collectString(record.thread_hash, hashes);
  collectString(record.root_parent_hash, hashes);
  const parent = asRecord(record.parent);
  if (parent) {
    collectString(parent.hash, hashes);
    collectString(parent.url, urls);
  }
  collectString(record.parent_url, urls);
  collectString(record.root_parent_url, urls);
  return { hashes, urls };
}

export function parseReplyCast(raw: unknown): ParsedReply | null {
  const record = asRecord(raw);
  if (!record) {
    return null;
  }
  const hash = normalizeCastHash(
    typeof record.hash === "string" ? record.hash : "",
  );
  const author = asRecord(record.author);
  const authorFid = typeof author?.fid === "number" ? author.fid : null;
  if (!hash || authorFid === null || authorFid <= 0) {
    return null;
  }
  const parents = extractReplyParents(record);
  return {
    hash,
    authorFid,
    parentHashes: parents.hashes.map((item) => normalizeCastHash(item)),
    parentUrls: parents.urls,
  };
}

export function parseReplyFeed(payload: unknown): {
  replies: ParsedReply[];
  cursor: string | null;
} {
  const record = asRecord(payload);
  const list = Array.isArray(record?.casts)
    ? record.casts
    : Array.isArray(record?.replies)
      ? record.replies
      : [];
  const replies = list
    .map(parseReplyCast)
    .filter((entry): entry is ParsedReply => Boolean(entry));
  const next = asRecord(record?.next);
  const cursor = typeof next?.cursor === "string" ? next.cursor : null;
  return { replies, cursor };
}

export function replyMatchesTargetCast(
  reply: ParsedReply,
  participantFid: number,
  target: { hash?: string | null; url?: string | null },
): boolean {
  if (reply.authorFid !== participantFid) {
    return false;
  }
  if (target.hash && reply.parentHashes.some((hash) => hashesReferToSameCast(hash, target.hash))) {
    return true;
  }
  const targetUrl = target.url?.trim().toLowerCase();
  if (targetUrl) {
    return reply.parentUrls.some(
      (url) => url.trim().toLowerCase() === targetUrl,
    );
  }
  return false;
}

export function findMatchingReply(
  replies: ParsedReply[],
  participantFid: number,
  target: { hash?: string | null; url?: string | null },
): ParsedReply | null {
  return (
    replies.find((reply) =>
      replyMatchesTargetCast(reply, participantFid, target),
    ) ?? null
  );
}

export function parseCastLookup(payload: unknown): ParsedCastLookup | null {
  const root = asRecord(payload);
  const cast = asRecord(root?.cast) ?? root;
  if (!cast) {
    return null;
  }
  const hash = normalizeCastHash(typeof cast.hash === "string" ? cast.hash : "");
  const author = asRecord(cast.author);
  const authorFid = typeof author?.fid === "number" ? author.fid : null;
  if (!hash || authorFid === null || authorFid <= 0) {
    return null;
  }
  const viewer = asRecord(cast.viewer_context);
  return {
    hash,
    url: typeof cast.url === "string" ? cast.url : null,
    authorFid,
    liked: viewer?.liked === true,
    recasted: viewer?.recasted === true,
  };
}

function parseScore(raw: unknown): number | null {
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : null;
}

export function parseNeynarUserProfile(
  payload: unknown,
  fid: number,
): ParsedUserProfile | null {
  const root = asRecord(payload);
  const users = Array.isArray(root?.users) ? root.users : [];
  for (const item of users) {
    const record = asRecord(item);
    if (record && record.fid === fid) {
      return parseNeynarUserRecord(record);
    }
  }
  return null;
}

export function parseNeynarUserRecord(
  record: Record<string, unknown>,
): ParsedUserProfile | null {
  const fid = typeof record.fid === "number" ? record.fid : null;
  if (fid === null || fid <= 0) {
    return null;
  }

  const experimental = asRecord(record.experimental);
  const scoreFromRoot = parseScore(record.score);
  const scoreFromExperimental = parseScore(experimental?.neynar_user_score);
  const score = scoreFromRoot ?? scoreFromExperimental;
  const scoreSource: ParsedUserProfile["scoreSource"] = scoreFromRoot !== null
    ? "score"
    : scoreFromExperimental !== null
      ? "experimental.neynar_user_score"
      : null;

  const followerCount = Number(record.follower_count);
  const pfp = typeof record.pfp_url === "string" ? record.pfp_url.trim() : "";
  const registeredAt =
    typeof record.registered_at === "string" ? record.registered_at : null;

  return {
    fid,
    followerCount: Number.isFinite(followerCount) ? followerCount : 0,
    score,
    scoreSource,
    registeredAt,
    pfpUrl: pfp || null,
  };
}

export function accountAgeDays(
  registeredAt: string | null,
  nowMs = Date.now(),
): number | null {
  if (!registeredAt) {
    return null;
  }
  const created = Date.parse(registeredAt);
  if (!Number.isFinite(created)) {
    return null;
  }
  return Math.floor((nowMs - created) / 86_400_000);
}

export function hasAudienceRestrictions(rules: AudienceRules | null | undefined): boolean {
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

export function evaluateAudience(
  profile: ParsedUserProfile | null,
  rules: AudienceRules | null | undefined,
  nowMs = Date.now(),
): AudienceCheckResult {
  if (!hasAudienceRestrictions(rules)) {
    return {
      ok: true,
      checks: [
        {
          type: "audience",
          status: "passed",
          message: "No audience restrictions",
        },
      ],
    };
  }

  if (!profile) {
    return {
      ok: false,
      checks: [
        {
          type: "audience",
          status: "failed",
          message: "Could not load Farcaster profile for audience checks",
        },
      ],
    };
  }

  const checks: VerificationCheck[] = [];

  if (typeof rules?.minimum_followers === "number" && rules.minimum_followers > 0) {
    const ok = profile.followerCount >= rules.minimum_followers;
    checks.push({
      type: "audience.followers",
      status: ok ? "passed" : "failed",
      message: ok
        ? `Followers ${profile.followerCount} meet ${rules.minimum_followers}+`
        : `Followers ${profile.followerCount} below ${rules.minimum_followers}+`,
    });
  }

  if (
    typeof rules?.minimum_neynar_score === "number" &&
    rules.minimum_neynar_score > 0
  ) {
    if (profile.score === null) {
      checks.push({
        type: "audience.score",
        status: "failed",
        message: "Neynar score unavailable; cannot verify minimum score",
      });
    } else {
      const ok = profile.score >= rules.minimum_neynar_score;
      checks.push({
        type: "audience.score",
        status: ok ? "passed" : "failed",
        message: ok
          ? `Neynar score meets ${rules.minimum_neynar_score}`
          : `Neynar score below ${rules.minimum_neynar_score}`,
      });
    }
  }

  if (
    typeof rules?.minimum_account_age_days === "number" &&
    rules.minimum_account_age_days > 0
  ) {
    const age = accountAgeDays(profile.registeredAt, nowMs);
    if (age === null) {
      checks.push({
        type: "audience.age",
        status: "failed",
        message: "Account registration date unavailable",
      });
    } else {
      const ok = age >= rules.minimum_account_age_days;
      checks.push({
        type: "audience.age",
        status: ok ? "passed" : "failed",
        message: ok
          ? `Account age ${age}d meets ${rules.minimum_account_age_days}d`
          : `Account age ${age}d below ${rules.minimum_account_age_days}d`,
      });
    }
  }

  if (rules?.non_spam_only === true) {
    if (profile.score === null) {
      checks.push({
        type: "audience.non_spam",
        status: "failed",
        message: "Neynar score unavailable; cannot verify non-spam",
      });
    } else {
      const ok = profile.score >= NON_SPAM_MIN_SCORE;
      checks.push({
        type: "audience.non_spam",
        status: ok ? "passed" : "failed",
        message: ok
          ? "Neynar score meets non-spam threshold"
          : "Neynar score below non-spam threshold",
      });
    }
  }

  if (rules?.profile_photo_required === true) {
    const ok = Boolean(profile.pfpUrl);
    checks.push({
      type: "audience.photo",
      status: ok ? "passed" : "failed",
      message: ok ? "Profile photo present" : "Profile photo required",
    });
  }

  return {
    ok: checks.every((check) => check.status === "passed"),
    checks,
  };
}

export function missingFidCheck(): VerificationCheck {
  return {
    type: "identity",
    status: "ineligible",
    message:
      "No Farcaster FID is linked to this wallet. Connect a Farcaster-linked wallet.",
  };
}

export function unsupportedMiniAppCheck(): VerificationCheck {
  return {
    type: "mini_app",
    status: "unsupported",
    message:
      "Mini App open cannot be verified. URL inspection is not proof of opening.",
  };
}

export function unsupportedShareSnapCheck(): VerificationCheck {
  return {
    type: "share_snap",
    status: "unsupported",
    message:
      "Share Snap cannot be verified. Web Share / clipboard is not Farcaster proof.",
  };
}

export function checkFollow(following: boolean): VerificationCheck {
  return {
    type: "follow",
    status: following ? "passed" : "failed",
    message: following
      ? "Following the target account"
      : "Not following the target account",
  };
}

export function checkLike(liked: boolean): VerificationCheck {
  return {
    type: "like",
    status: liked ? "passed" : "failed",
    message: liked ? "Liked the target cast" : "Has not liked the target cast",
  };
}

export function checkRecast(recasted: boolean): VerificationCheck {
  return {
    type: "recast",
    status: recasted ? "passed" : "failed",
    message: recasted
      ? "Recasted the target cast"
      : "Has not recasted the target cast",
  };
}

export function checkComment(found: boolean): VerificationCheck {
  return {
    type: "comment",
    status: found ? "passed" : "failed",
    message: found
      ? "Commented on the target cast"
      : "No reply on the target cast was found",
  };
}

export function combineTaskChecks(
  parts: VerificationCheck[][],
): VerificationCheck[] {
  return parts.flat();
}

/** Share extras are reported but never treated as proof or as a required pass. */
export function isRequiredVerificationCheck(check: VerificationCheck): boolean {
  return check.type !== "share_snap" && check.type !== "share_cast";
}

export function allChecksPassed(checks: VerificationCheck[]): boolean {
  const required = checks.filter(isRequiredVerificationCheck);
  return (
    required.length > 0 && required.every((check) => check.status === "passed")
  );
}

export function summarizeFailure(checks: VerificationCheck[]): string {
  const failed = checks.filter(
    (check) =>
      check.status !== "passed" && isRequiredVerificationCheck(check),
  );
  if (failed.length === 0) {
    return "";
  }
  return failed.map((check) => check.message).join("; ");
}

export function toPublicChecks(checks: VerificationCheck[]): VerificationCheck[] {
  return checks.map((check) => ({
    type: check.type,
    status: check.status,
    message: check.message,
  }));
}
