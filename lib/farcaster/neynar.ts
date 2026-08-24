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

function mapSearchUser(user: NeynarUser): FarcasterUserSearchResult | null {
  if (typeof user.fid !== "number" || user.fid <= 0) {
    return null;
  }
  const username = user.username?.trim();
  if (!username) {
    return null;
  }
  return {
    fid: user.fid,
    username,
    displayName: user.display_name?.trim() || null,
    pfpUrl: user.pfp_url?.trim() || null,
  };
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
 * Returns [] when Neynar is unavailable — never trusts a client FID.
 */
export async function searchFarcasterUsers(
  query: string,
  limit = 8,
): Promise<FarcasterUserSearchResult[]> {
  const q = query.trim().replace(/^@/, "");
  if (q.length < 2 || !hasNeynarKey()) {
    return [];
  }

  const apiKey = getNeynarApiKey();
  const url = new URL(`${NEYNAR_API_BASE}/user/search/`);
  url.searchParams.set("q", q);
  url.searchParams.set("limit", String(Math.min(20, Math.max(1, limit))));

  const response = await fetch(url, {
    headers: neynarHeaders(apiKey),
    cache: "no-store",
  });

  const json = (await response.json()) as {
    result?: { users?: NeynarUser[] };
    users?: NeynarUser[];
    message?: string;
  };

  if (!response.ok) {
    console.error("[neynar] user/search failed", {
      status: response.status,
      message: json.message,
    });
    return [];
  }

  const users = json.result?.users ?? json.users ?? [];
  return users
    .map(mapSearchUser)
    .filter((user): user is FarcasterUserSearchResult => Boolean(user));
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
