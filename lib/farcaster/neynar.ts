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
  viewer_context?: {
    following?: boolean;
    followed_by?: boolean;
  };
};

function neynarHeaders(apiKey: string): HeadersInit {
  return {
    accept: "application/json",
    "x-api-key": apiKey,
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
 */
export async function doesFidFollowTarget(params: {
  viewerFid: number;
  targetFid?: number;
  targetUsername?: string;
}): Promise<boolean> {
  const apiKey = getNeynarApiKey();
  const targetFid = params.targetFid ?? FARCASTER_FOLLOW_QUEST_TARGET.fid;
  const targetUsername =
    params.targetUsername ?? FARCASTER_FOLLOW_QUEST_TARGET.username;

  // Prefer username lookup with viewer_fid (official Neynar pattern for relation).
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

  // Fallback: bulk user by FID with viewer_fid (still O(1), no follow list).
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
      fidJson.message ||
        usernameJson.message ||
        `Neynar follow check failed (${fidResponse.status})`,
    );
  }

  const user = fidJson.users?.find((entry) => entry.fid === targetFid);
  if (typeof user?.viewer_context?.following === "boolean") {
    return user.viewer_context.following;
  }

  throw new Error("Neynar response missing viewer_context.following");
}
