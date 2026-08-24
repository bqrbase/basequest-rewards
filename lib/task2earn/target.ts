import type {
  CastTaskTarget,
  FollowTaskTarget,
  MiniAppTaskTarget,
  TaskTarget,
  TaskType,
} from "@/lib/task2earn/types";

const CAST_HOSTS = new Set([
  "warpcast.com",
  "www.warpcast.com",
  "farcaster.xyz",
  "www.farcaster.xyz",
  "farcaster.com",
  "www.farcaster.com",
]);

const HASH_RE = /0x[a-fA-F0-9]{8,40}/;
const USERNAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,39}$/;
const CHANNEL_RE = /^[a-zA-Z0-9._-]{1,64}$/;

export function needsCastTarget(taskType: TaskType): boolean {
  return (
    taskType === "like" ||
    taskType === "recast" ||
    taskType === "comment" ||
    taskType === "like_recast" ||
    taskType === "like_recast_comment" ||
    taskType === "bundle"
  );
}

export function needsFollowTarget(taskType: TaskType): boolean {
  return taskType === "follow";
}

export function needsMiniAppTarget(taskType: TaskType): boolean {
  return taskType === "mini_app";
}

export function normalizeFarcasterUsername(raw: string): string {
  return raw.trim().replace(/^@/, "").toLowerCase();
}

export function isValidFarcasterUsername(raw: string): boolean {
  return USERNAME_RE.test(normalizeFarcasterUsername(raw));
}

/**
 * Parse a Farcaster/Warpcast cast URL.
 * Stores hash/channel only when they appear in the URL — never infers FID.
 */
export function parseFarcasterCastUrl(raw: string): CastTaskTarget | null {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  if (!CAST_HOSTS.has(host)) {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return null;
  }
  parsed.protocol = "https:";

  const fromPath = parsed.pathname.match(HASH_RE);
  const fromSearch = parsed.search.match(HASH_RE);
  const hashMatch = fromPath?.[0] ?? fromSearch?.[0] ?? null;

  const channelMatch = parsed.pathname.match(/\/~\/channel\/([a-zA-Z0-9._-]+)/);
  const channelId =
    channelMatch?.[1] && CHANNEL_RE.test(channelMatch[1])
      ? channelMatch[1]
      : null;

  return {
    kind: "cast",
    url: parsed.toString(),
    castHash: hashMatch ? hashMatch.toLowerCase() : null,
    channelId,
  };
}

export function isPublicHttpsUrl(raw: string): URL | null {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host === "[::1]"
  ) {
    return null;
  }
  if (isPrivateOrLocalHostname(host)) {
    return null;
  }
  return parsed;
}

function isPrivateOrLocalHostname(host: string): boolean {
  if (host === "127.0.0.1") {
    return true;
  }
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) {
    return false;
  }
  const parts = ipv4.slice(1).map(Number);
  if (parts.some((part) => part > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) {
    return true;
  }
  if (a === 169 && b === 254) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  return false;
}

export function parseTaskTarget(value: unknown): TaskTarget | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const raw = value as Record<string, unknown>;
  if (raw.kind === "cast" && typeof raw.url === "string") {
    const parsed = parseFarcasterCastUrl(raw.url);
    if (!parsed) {
      return null;
    }
    return {
      ...parsed,
      castHash:
        typeof raw.castHash === "string" && HASH_RE.test(raw.castHash)
          ? raw.castHash.toLowerCase()
          : parsed.castHash,
      channelId:
        typeof raw.channelId === "string" && CHANNEL_RE.test(raw.channelId)
          ? raw.channelId
          : parsed.channelId,
    };
  }
  if (raw.kind === "follow" && typeof raw.username === "string") {
    if (!isValidFarcasterUsername(raw.username)) {
      return null;
    }
    const follow: FollowTaskTarget = {
      kind: "follow",
      username: normalizeFarcasterUsername(raw.username),
      fid:
        typeof raw.fid === "number" && Number.isInteger(raw.fid) && raw.fid > 0
          ? raw.fid
          : null,
      displayName: typeof raw.displayName === "string" ? raw.displayName : null,
    };
    return follow;
  }
  if (raw.kind === "mini_app" && typeof raw.url === "string") {
    const url = isPublicHttpsUrl(raw.url);
    if (!url) {
      return null;
    }
    const mini: MiniAppTaskTarget = {
      kind: "mini_app",
      url: url.toString(),
      name: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : null,
      appId: typeof raw.appId === "string" && raw.appId.trim() ? raw.appId.trim() : null,
      metadata:
        raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)
          ? (raw.metadata as Record<string, unknown>)
          : {},
    };
    return mini;
  }
  return null;
}

export function formatTaskTargetSummary(target: TaskTarget | null): string {
  if (!target) {
    return "Not set";
  }
  if (target.kind === "cast") {
    return target.castHash
      ? `${target.url} (${target.castHash.slice(0, 10)}…)`
      : target.url;
  }
  if (target.kind === "follow") {
    return target.fid
      ? `@${target.username} (FID ${target.fid})`
      : `@${target.username}`;
  }
  return target.name ? `${target.name} — ${target.url}` : target.url;
}
