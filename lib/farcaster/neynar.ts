import { FARCASTER_FOLLOW_QUEST_TARGET } from "@/lib/community-quests";

const NEYNAR_API_BASE = "https://api.neynar.com/v2/farcaster";

export function getNeynarApiKey(): string {
  const value = process.env.NEYNAR_API_KEY?.trim();
  if (!value) {
    throw new Error("NEYNAR_API_KEY is not configured");
  }
  return value;
}

type NeynarUser = {
  fid: number;
  username?: string;
  display_name?: string;
  pfp_url?: string;
  viewer_context?: {
    following?: boolean;
    followed_by?: boolean;
  };
};

export type FarcasterUserSearchResult = {
  fid: number;
  username: string;
  displayName: string | null;
  pfpUrl: string | null;
};

function mapSearchUser(user: NeynarUser | Record<string, unknown>): FarcasterUserSearchResult | null {
  const raw = user as NeynarUser & {
    displayName?: string;
    pfpUrl?: string;
    pfp?: { url?: string };
  };
  const fid = typeof raw.fid === "number" ? raw.fid : Number(raw.fid);
  if (!Number.isInteger(fid) || fid <= 0) {
    return null;
  }
  const username =
    typeof raw.username === "string" ? raw.username.trim() : "";
  if (!username) {
    return null;
  }
  const displayName =
    raw.display_name?.trim() ||
    (typeof raw.displayName === "string" ? raw.displayName.trim() : "") ||
    null;
  const pfpUrl =
    raw.pfp_url?.trim() ||
    (typeof raw.pfpUrl === "string" ? raw.pfpUrl.trim() : "") ||
    raw.pfp?.url?.trim() ||
    null;
  return {
    fid,
    username,
    displayName,
    pfpUrl,
  };
}

function extractSearchUsers(payload: unknown): NeynarUser[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }
  const root = payload as {
    result?: { users?: unknown };
    users?: unknown;
  };
  const users = root.result?.users ?? root.users;
  return Array.isArray(users) ? (users as NeynarUser[]) : [];
}

async function readNeynarJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(
      `Neynar returned non-JSON (${response.status})`,
    );
  }
}

function neynarHeaders(apiKey: string, experimental = false): HeadersInit {
  return {
    accept: "application/json",
    "x-api-key": apiKey,
    ...(experimental ? { "x-neynar-experimental": "true" } : {}),
  };
}

/**
 * Resolve a Farcaster FID from a connected wallet address (custody or verified).
 */
export async function lookupFidByWalletAddress(
  walletAddress: string,
): Promise<number | null> {
  const apiKey = getNeynarApiKey();
  const url = new URL(`${NEYNAR_API_BASE}/user/bulk-by-address/`);
  url.searchParams.set("addresses", walletAddress.toLowerCase());

  const response = await fetch(url, {
    headers: neynarHeaders(apiKey),
    cache: "no-store",
  });

  const json = (await response.json()) as Record<string, NeynarUser[]> & {
    message?: string;
    code?: string;
  };

  if (!response.ok) {
    console.error("[neynar] bulk-by-address failed", {
      status: response.status,
      message: json.message,
    });
    throw new Error(json.message || `Neynar address lookup failed (${response.status})`);
  }

  const users =
    json[walletAddress.toLowerCase()] ??
    json[walletAddress] ??
    Object.values(json).find((value) => Array.isArray(value)) ??
    [];

  const fid = users[0]?.fid;
  return typeof fid === "number" && fid > 0 ? fid : null;
}

/**
 * Best-practice follow check: fetch target profile with viewer_fid so Neynar
 * returns viewer_context.following — no large following-list download.
 *
 * Pass an explicit targetFid and/or targetUsername. Defaults to the community
 * quest target only when both are omitted (existing quest behavior).
 * Do not omit the target when verifying Task2Earn (would incorrectly check @hqc).
 */
export async function doesFidFollowTarget(params: {
  viewerFid: number;
  targetFid?: number;
  targetUsername?: string;
}): Promise<boolean> {
  const apiKey = getNeynarApiKey();
  const hasExplicitTarget =
    typeof params.targetFid === "number" ||
    Boolean(params.targetUsername?.trim());
  const targetFid = hasExplicitTarget
    ? params.targetFid
    : FARCASTER_FOLLOW_QUEST_TARGET.fid;
  const targetUsername = hasExplicitTarget
    ? params.targetUsername?.trim()
    : FARCASTER_FOLLOW_QUEST_TARGET.username;

  if (targetUsername) {
    const byUsername = new URL(`${NEYNAR_API_BASE}/user/by_username/`);
    byUsername.searchParams.set("username", targetUsername);
    byUsername.searchParams.set("viewer_fid", String(params.viewerFid));

    const usernameResponse = await fetch(byUsername, {
      headers: neynarHeaders(apiKey),
      cache: "no-store",
    });

    const usernameJson = (await usernameResponse.json()) as {
      user?: NeynarUser;
      message?: string;
    };

    if (usernameResponse.ok && usernameJson.user) {
      if (typeof usernameJson.user.viewer_context?.following === "boolean") {
        return usernameJson.user.viewer_context.following;
      }
    } else {
      console.error("[neynar] by_username failed", {
        status: usernameResponse.status,
        message: usernameJson.message,
      });
    }
  }

  if (typeof targetFid !== "number" || targetFid <= 0) {
    throw new Error("Neynar follow check requires a target FID or username");
  }

  const byFid = new URL(`${NEYNAR_API_BASE}/user/bulk/`);
  byFid.searchParams.set("fids", String(targetFid));
  byFid.searchParams.set("viewer_fid", String(params.viewerFid));

  const fidResponse = await fetch(byFid, {
    headers: neynarHeaders(apiKey),
    cache: "no-store",
  });

  const fidJson = (await fidResponse.json()) as {
    users?: NeynarUser[];
    message?: string;
  };

  if (!fidResponse.ok) {
    console.error("[neynar] user/bulk failed", {
      status: fidResponse.status,
      message: fidJson.message,
    });
    throw new Error(
      fidJson.message || `Neynar follow check failed (${fidResponse.status})`,
    );
  }

  const user = fidJson.users?.find((entry) => entry.fid === targetFid);
  if (typeof user?.viewer_context?.following === "boolean") {
    return user.viewer_context.following;
  }

  throw new Error("Neynar response missing viewer_context.following");
}

function hasNeynarKey(): boolean {
  return Boolean(process.env.NEYNAR_API_KEY?.trim());
}

/**
 * Search Farcaster users by username/display name.
 * Neynar search max `limit` is 10. Never trusts a client FID.
 * Throws on Neynar/network failure so callers can show an error instead
 * of an empty "no users" state. Exact-username lookup is used as fallback.
 */
export async function searchFarcasterUsers(
  query: string,
  limit = 8,
): Promise<FarcasterUserSearchResult[]> {
  const q = query.trim().replace(/^@/, "");
  if (q.length < 2) {
    return [];
  }

  const apiKey = getNeynarApiKey();
  const cappedLimit = Math.min(10, Math.max(1, limit));
  const url = new URL(`${NEYNAR_API_BASE}/user/search`);
  url.searchParams.set("q", q);
  url.searchParams.set("limit", String(cappedLimit));

  try {
    const response = await fetch(url, {
      headers: neynarHeaders(apiKey),
      cache: "no-store",
    });
    const json = (await readNeynarJson(response)) as {
      result?: { users?: NeynarUser[] };
      users?: NeynarUser[];
      message?: string;
      code?: string;
    } | null;

    if (!response.ok) {
      const message =
        json && typeof json === "object"
          ? json.message || json.code
          : null;
      console.error("[neynar] user/search failed", {
        status: response.status,
        message,
      });
      const searched = await lookupFarcasterUserByUsername(q);
      if (searched) {
        return [searched];
      }
      throw new Error(
        message || `Farcaster user search failed (${response.status})`,
      );
    }

    const users = extractSearchUsers(json)
      .map(mapSearchUser)
      .filter((user): user is FarcasterUserSearchResult => Boolean(user));
    const hasExact = users.some(
      (user) => user.username.toLowerCase() === q.toLowerCase(),
    );
    if (hasExact) {
      return users;
    }
    const exact = await lookupFarcasterUserByUsername(q);
    if (exact) {
      return [exact, ...users];
    }
    return users;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Farcaster user search failed")) {
      throw error;
    }
    const exact = await lookupFarcasterUserByUsername(q);
    if (exact) {
      return [exact];
    }
    throw error instanceof Error
      ? error
      : new Error("Farcaster user search failed");
  }
}

export type FarcasterMiniAppSearchResult = {
  name: string;
  url: string;
  iconUrl: string | null;
  authorUsername: string | null;
  authorDisplayName: string | null;
  authorFid: number | null;
};

type NeynarMiniAppFrame = {
  title?: string;
  frames_url?: string;
  manifest?: {
    miniapp?: {
      name?: string;
      home_url?: string;
      icon_url?: string;
    };
    frame?: {
      name?: string;
      home_url?: string;
      icon_url?: string;
    };
  };
  author?: {
    fid?: number;
    username?: string;
    display_name?: string;
    displayName?: string;
  };
};

function mapSearchMiniApp(
  frame: NeynarMiniAppFrame | Record<string, unknown>,
): FarcasterMiniAppSearchResult | null {
  const raw = frame as NeynarMiniAppFrame;
  const miniapp = raw.manifest?.miniapp;
  const legacy = raw.manifest?.frame;
  const name =
    miniapp?.name?.trim() ||
    legacy?.name?.trim() ||
    raw.title?.trim() ||
    "";
  if (!name) {
    return null;
  }
  const url =
    miniapp?.home_url?.trim() ||
    legacy?.home_url?.trim() ||
    raw.frames_url?.trim() ||
    "";
  if (!url) {
    return null;
  }
  const fidRaw = raw.author?.fid;
  const fid = typeof fidRaw === "number" ? fidRaw : Number(fidRaw);
  return {
    name,
    url,
    iconUrl: miniapp?.icon_url?.trim() || legacy?.icon_url?.trim() || null,
    authorUsername: raw.author?.username?.trim() || null,
    authorDisplayName:
      raw.author?.display_name?.trim() ||
      raw.author?.displayName?.trim() ||
      null,
    authorFid: Number.isInteger(fid) && fid > 0 ? fid : null,
  };
}

/**
 * Search indexed Farcaster Mini Apps by name.
 * Uses Neynar frame search. Throws on Neynar/network failure so callers
 * can show an error instead of an empty "no apps" state.
 */
export async function searchFarcasterMiniApps(
  query: string,
  limit = 8,
): Promise<FarcasterMiniAppSearchResult[]> {
  const q = query.trim().slice(0, 32);
  if (q.length < 2) {
    return [];
  }

  const apiKey = getNeynarApiKey();
  const cappedLimit = Math.min(20, Math.max(1, limit));
  const url = new URL(`${NEYNAR_API_BASE}/frame/search`);
  url.searchParams.set("q", q);
  url.searchParams.set("limit", String(cappedLimit));

  const response = await fetch(url, {
    headers: neynarHeaders(apiKey),
    cache: "no-store",
  });
  const json = (await readNeynarJson(response)) as {
    frames?: NeynarMiniAppFrame[];
    message?: string;
    code?: string;
  } | null;

  if (!response.ok) {
    const message =
      json && typeof json === "object"
        ? json.message || json.code
        : null;
    console.error("[neynar] frame/search failed", {
      status: response.status,
      message,
    });
    throw new Error(
      message || `Farcaster Mini App search failed (${response.status})`,
    );
  }

  const frames = Array.isArray(json?.frames) ? json.frames : [];
  const seen = new Set<string>();
  const apps: FarcasterMiniAppSearchResult[] = [];
  for (const frame of frames) {
    const mapped = mapSearchMiniApp(frame);
    if (!mapped) {
      continue;
    }
    let normalized: string;
    try {
      normalized = new URL(mapped.url).href;
    } catch {
      continue;
    }
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    apps.push(mapped);
  }
  return apps;
}

/**
 * Server-side username lookup. FID is taken from Neynar, never from the client.
 */
export async function lookupFarcasterUserByUsername(
  username: string,
): Promise<FarcasterUserSearchResult | null> {
  const normalized = username.trim().replace(/^@/, "");
  if (!normalized || !hasNeynarKey()) {
    return null;
  }

  const apiKey = getNeynarApiKey();
  const url = new URL(`${NEYNAR_API_BASE}/user/by_username/`);
  url.searchParams.set("username", normalized);

  const response = await fetch(url, {
    headers: neynarHeaders(apiKey),
    cache: "no-store",
  });

  const json = (await response.json()) as {
    user?: NeynarUser;
    message?: string;
  };

  if (!response.ok || !json.user) {
    return null;
  }

  return mapSearchUser(json.user);
}

/**
 * Server-side FID lookup. FID is taken from Neynar, never from the client.
 */
export async function lookupFarcasterUserByFid(
  fid: number,
): Promise<FarcasterUserSearchResult | null> {
  if (!Number.isInteger(fid) || fid <= 0 || !hasNeynarKey()) {
    return null;
  }

  const payload = await fetchUsersByFids([fid]);
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const users = (payload as { users?: NeynarUser[] }).users;
  if (!Array.isArray(users)) {
    return null;
  }
  const user = users.find((entry) => entry.fid === fid);
  return user ? mapSearchUser(user) : null;
}

export type NeynarCastQuery = {
  url?: string | null;
  hash?: string | null;
  viewerFid?: number;
};

/**
 * Lookup a cast by URL (preferred) or hash. Pass viewerFid for liked/recasted.
 */
export async function fetchCastByHashOrUrl(
  query: NeynarCastQuery,
): Promise<unknown | null> {
  const apiKey = getNeynarApiKey();
  const urlValue = query.url?.trim() ?? "";
  const hashValue = query.hash?.trim() ?? "";
  const useUrl = /^https?:\/\//i.test(urlValue);
  const identifier = useUrl ? urlValue : hashValue;
  if (!identifier) {
    return null;
  }

  const url = new URL(`${NEYNAR_API_BASE}/cast/`);
  url.searchParams.set("identifier", identifier);
  url.searchParams.set("type", useUrl ? "url" : "hash");
  if (typeof query.viewerFid === "number" && query.viewerFid > 0) {
    url.searchParams.set("viewer_fid", String(query.viewerFid));
  }

  const response = await fetch(url, {
    headers: neynarHeaders(apiKey),
    cache: "no-store",
  });
  const json: unknown = await response.json();
  if (!response.ok) {
    console.error("[neynar] cast lookup failed", {
      status: response.status,
    });
    return null;
  }
  return json;
}

/**
 * Participant-scoped replies. Do not crawl a cast's full conversation.
 */
export async function fetchUserRepliesPage(params: {
  fid: number;
  cursor?: string | null;
  limit?: number;
}): Promise<unknown | null> {
  const apiKey = getNeynarApiKey();
  const url = new URL(`${NEYNAR_API_BASE}/feed/user/replies_and_recasts/`);
  url.searchParams.set("fid", String(params.fid));
  url.searchParams.set("filter", "replies");
  url.searchParams.set("limit", String(Math.min(50, Math.max(1, params.limit ?? 50))));
  if (params.cursor) {
    url.searchParams.set("cursor", params.cursor);
  }

  const response = await fetch(url, {
    headers: neynarHeaders(apiKey),
    cache: "no-store",
  });
  const json: unknown = await response.json();
  if (!response.ok) {
    console.error("[neynar] replies feed failed", { status: response.status });
    return null;
  }
  return json;
}

/**
 * Recent original casts by FID (replies excluded by default).
 * Used as Share Cast proof fallback when a hash hint is missing or fails.
 */
export async function fetchUserCastsPage(params: {
  fid: number;
  cursor?: string | null;
  limit?: number;
  includeReplies?: boolean;
}): Promise<unknown | null> {
  const apiKey = getNeynarApiKey();
  const url = new URL(`${NEYNAR_API_BASE}/feed/user/casts/`);
  url.searchParams.set("fid", String(params.fid));
  url.searchParams.set(
    "include_replies",
    params.includeReplies === true ? "true" : "false",
  );
  url.searchParams.set(
    "limit",
    String(Math.min(50, Math.max(1, params.limit ?? 50))),
  );
  if (params.cursor) {
    url.searchParams.set("cursor", params.cursor);
  }

  const response = await fetch(url, {
    headers: neynarHeaders(apiKey),
    cache: "no-store",
  });
  const json: unknown = await response.json();
  if (!response.ok) {
    console.error("[neynar] user casts feed failed", { status: response.status });
    return null;
  }
  return json;
}

/**
 * User bulk lookup. Requests the experimental header so score fields are present
 * when the live API provides them.
 */
export async function fetchUsersByFids(fids: number[]): Promise<unknown | null> {
  const unique = [...new Set(fids.filter((fid) => Number.isInteger(fid) && fid > 0))];
  if (unique.length === 0) {
    return null;
  }
  const apiKey = getNeynarApiKey();
  const url = new URL(`${NEYNAR_API_BASE}/user/bulk/`);
  url.searchParams.set("fids", unique.join(","));

  const response = await fetch(url, {
    headers: neynarHeaders(apiKey, true),
    cache: "no-store",
  });
  const json: unknown = await response.json();
  if (!response.ok) {
    console.error("[neynar] user/bulk profile failed", { status: response.status });
    return null;
  }
  return json;
}
