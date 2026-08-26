/**
 * Pure Share Cast proof checks. Network I/O lives in share-reward.ts.
 * Client hash/FID/amount are never treated as proof here.
 */

import { MINI_APP_ORIGIN } from "../miniapp/share";
import { SHARE_CAST_MAX_AGE_MS } from "./constants";
import { normalizeCastHash } from "./verification-logic";

export const SHARE_CAST_FUTURE_SKEW_MS = 2 * 60 * 1000;
export const SHARE_CAST_SCAN_PAGE_LIMIT = 50;
export const SHARE_CAST_SCAN_MAX_PAGES = 2;

export type ShareCastProofReason =
  | "valid"
  | "missing_cast"
  | "wrong_author"
  | "reply"
  | "recast_or_quote"
  | "listing_url"
  | "url_in_text_only"
  | "wrong_task_url"
  | "stale_cast"
  | "before_task"
  | "unfetchable";

export type ParsedShareCast = {
  hash: string;
  authorFid: number;
  timestampMs: number;
  text: string;
  parentHash: string | null;
  embedUrls: string[];
  hasQuotedCast: boolean;
  isRecast: boolean;
};

export type ShareCastProofRules = {
  expectedFid: number;
  taskUrl: string;
  taskCreatedAtMs: number;
  nowMs: number;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export function normalizeShareEmbedUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }
  try {
    const url = new URL(trimmed);
    url.hash = "";
    const path = url.pathname.replace(/\/+$/, "");
    return `${url.protocol}//${url.host.toLowerCase()}${path}${url.search}`;
  } catch {
    return trimmed.toLowerCase().replace(/\/+$/, "");
  }
}

export function taskListingUrl(): string {
  return `${MINI_APP_ORIGIN}/tasks`;
}

export function isTaskListingUrl(url: string): boolean {
  return normalizeShareEmbedUrl(url) === normalizeShareEmbedUrl(taskListingUrl());
}

function collectEmbeds(raw: unknown): {
  embedUrls: string[];
  hasQuotedCast: boolean;
} {
  const embedUrls: string[] = [];
  let hasQuotedCast = false;
  if (!Array.isArray(raw)) {
    return { embedUrls, hasQuotedCast };
  }
  for (const item of raw) {
    const embed = asRecord(item);
    if (!embed) {
      continue;
    }
    if (typeof embed.url === "string" && embed.url.trim()) {
      embedUrls.push(embed.url.trim());
    }
    if (embed.cast_id || embed.cast) {
      hasQuotedCast = true;
    }
  }
  return { embedUrls, hasQuotedCast };
}

function parseTimestampMs(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw < 1e12 ? raw * 1000 : raw;
  }
  if (typeof raw === "string" && raw.trim()) {
    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function detectRecast(record: Record<string, unknown>): boolean {
  if (record.recast === true || record.is_recast === true) {
    return true;
  }
  if (typeof record.type === "string" && record.type.toLowerCase() === "recast") {
    return true;
  }
  if (asRecord(record.recaster) || asRecord(record.recast)) {
    return true;
  }
  return false;
}

export function parseShareCast(raw: unknown): ParsedShareCast | null {
  const root = asRecord(raw);
  if (!root) {
    return null;
  }
  const cast = asRecord(root.cast) ?? root;
  const hash = normalizeCastHash(typeof cast.hash === "string" ? cast.hash : "");
  const author = asRecord(cast.author);
  const authorFid = typeof author?.fid === "number" ? author.fid : Number(author?.fid);
  const timestampMs = parseTimestampMs(cast.timestamp);
  if (!hash || !Number.isInteger(authorFid) || authorFid <= 0 || timestampMs === null) {
    return null;
  }

  const parentHashRaw =
    typeof cast.parent_hash === "string" ? cast.parent_hash.trim() : "";
  const { embedUrls, hasQuotedCast } = collectEmbeds(cast.embeds);

  return {
    hash,
    authorFid,
    timestampMs,
    text: typeof cast.text === "string" ? cast.text : "",
    parentHash: parentHashRaw ? normalizeCastHash(parentHashRaw) : null,
    embedUrls,
    hasQuotedCast,
    isRecast: detectRecast(cast),
  };
}

export function extractShareCasts(payload: unknown): ParsedShareCast[] {
  const root = asRecord(payload);
  const list = Array.isArray(root?.casts)
    ? root.casts
    : Array.isArray(asRecord(root?.result)?.casts)
      ? (asRecord(root?.result)?.casts as unknown[])
      : Array.isArray(root?.cast)
        ? [root.cast]
        : root?.cast
          ? [root.cast]
          : root
            ? [root]
            : [];
  return list
    .map(parseShareCast)
    .filter((entry): entry is ParsedShareCast => Boolean(entry));
}

export function extractFeedCursor(payload: unknown): string | null {
  const root = asRecord(payload);
  const next = asRecord(root?.next);
  return typeof next?.cursor === "string" && next.cursor.trim()
    ? next.cursor
    : null;
}

export function castEmbedsExactTaskUrl(
  cast: ParsedShareCast,
  taskUrl: string,
): boolean {
  const expected = normalizeShareEmbedUrl(taskUrl);
  if (!expected || isTaskListingUrl(expected)) {
    return false;
  }
  return cast.embedUrls.some(
    (url) => normalizeShareEmbedUrl(url) === expected,
  );
}

export function textMentionsUrl(text: string, taskUrl: string): boolean {
  const expected = normalizeShareEmbedUrl(taskUrl);
  if (!expected) {
    return false;
  }
  return normalizeShareEmbedUrl(text).includes(expected) ||
    text.toLowerCase().includes(taskUrl.toLowerCase());
}

export function evaluateShareCastProof(
  cast: ParsedShareCast | null,
  rules: ShareCastProofRules,
): ShareCastProofReason {
  if (!cast) {
    return "missing_cast";
  }
  if (cast.authorFid !== rules.expectedFid) {
    return "wrong_author";
  }
  if (cast.parentHash) {
    return "reply";
  }
  if (cast.isRecast || cast.hasQuotedCast) {
    return "recast_or_quote";
  }
  if (isTaskListingUrl(rules.taskUrl)) {
    return "listing_url";
  }
  const hasExactEmbed = castEmbedsExactTaskUrl(cast, rules.taskUrl);
  if (!hasExactEmbed) {
    const listingEmbedded = cast.embedUrls.some((url) => isTaskListingUrl(url));
    if (listingEmbedded) {
      return "listing_url";
    }
    if (textMentionsUrl(cast.text, rules.taskUrl)) {
      return "url_in_text_only";
    }
    return "wrong_task_url";
  }
  if (cast.timestampMs < rules.taskCreatedAtMs) {
    return "before_task";
  }
  if (cast.timestampMs > rules.nowMs + SHARE_CAST_FUTURE_SKEW_MS) {
    return "stale_cast";
  }
  if (cast.timestampMs < rules.nowMs - SHARE_CAST_MAX_AGE_MS) {
    return "stale_cast";
  }
  return "valid";
}

export function findMatchingShareCast(
  casts: readonly ParsedShareCast[],
  rules: ShareCastProofRules,
): { cast: ParsedShareCast; reason: ShareCastProofReason } | { cast: null; reason: ShareCastProofReason } {
  let lastReason: ShareCastProofReason = "missing_cast";
  for (const cast of casts) {
    const reason = evaluateShareCastProof(cast, rules);
    if (reason === "valid") {
      return { cast, reason };
    }
    lastReason = reason;
  }
  return { cast: null, reason: lastReason };
}
