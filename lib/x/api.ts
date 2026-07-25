import {
  getXBearerToken,
  getXClientId,
  getXClientSecret,
  X_TARGET_USERNAME,
} from "@/lib/x/config";

const X_API = "https://api.twitter.com";
const X_AUTH = "https://twitter.com";

export type XTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type: string;
  scope?: string;
};

export type XUser = {
  id: string;
  name: string;
  username: string;
};

function basicAuthHeader(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

export function buildXAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const url = new URL(`${X_AUTH}/i/oauth2/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set(
    "scope",
    ["tweet.read", "users.read", "follows.read", "offline.access"].join(" "),
  );
  url.searchParams.set("state", params.state);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export async function exchangeXCodeForToken(params: {
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<XTokenResponse> {
  const clientId = getXClientId();
  const clientSecret = getXClientSecret();

  const body = new URLSearchParams({
    code: params.code,
    grant_type: "authorization_code",
    client_id: clientId,
    redirect_uri: params.redirectUri,
    code_verifier: params.codeVerifier,
  });

  const response = await fetch(`${X_API}/2/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader(clientId, clientSecret),
    },
    body,
  });

  const json = (await response.json()) as XTokenResponse & {
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !json.access_token) {
    throw new Error(
      json.error_description || json.error || "Failed to exchange X OAuth code",
    );
  }

  return json;
}

export async function fetchXAuthenticatedUser(
  accessToken: string,
): Promise<XUser> {
  const response = await fetch(`${X_API}/2/users/me?user.fields=username,name`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  const json = (await response.json()) as {
    data?: XUser;
    errors?: Array<{ detail?: string; title?: string }>;
  };

  if (!response.ok || !json.data?.id) {
    throw new Error(
      json.errors?.[0]?.detail ||
        json.errors?.[0]?.title ||
        "Failed to fetch authenticated X user",
    );
  }

  return json.data;
}

let cachedTargetUserId: string | null = null;

/**
 * Resolve @bqrbase user id via X API v2 (app bearer token).
 */
export async function fetchTargetXUserId(): Promise<string> {
  if (cachedTargetUserId) {
    return cachedTargetUserId;
  }

  const bearer = getXBearerToken();
  const response = await fetch(
    `${X_API}/2/users/by/username/${X_TARGET_USERNAME}?user.fields=username`,
    {
      headers: {
        Authorization: `Bearer ${bearer}`,
      },
      cache: "no-store",
    },
  );

  const json = (await response.json()) as {
    data?: { id: string; username: string };
    errors?: Array<{ detail?: string; title?: string }>;
  };

  if (!response.ok || !json.data?.id) {
    throw new Error(
      json.errors?.[0]?.detail ||
        json.errors?.[0]?.title ||
        `Failed to resolve @${X_TARGET_USERNAME} (HTTP ${response.status})`,
    );
  }

  cachedTargetUserId = json.data.id;
  return cachedTargetUserId;
}

/**
 * Real X API v2 verification: does the authenticated user follow @bqrbase?
 * Uses user.fields=connection_status on the target user lookup (user OAuth token).
 * No timers / click-wait heuristics.
 *
 * Docs: GET /2/users/:id?user.fields=connection_status
 */
export async function doesUserFollowTarget(params: {
  accessToken: string;
  sourceUserId: string;
  targetUserId: string;
}): Promise<boolean> {
  void params.sourceUserId;

  const url = new URL(`${X_API}/2/users/${params.targetUserId}`);
  url.searchParams.set("user.fields", "connection_status,username");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
    },
    cache: "no-store",
  });

  const responseText = await response.text();
  let json: {
    data?: {
      id: string;
      username?: string;
      connection_status?: string[];
    };
    errors?: Array<{ detail?: string; title?: string }>;
    title?: string;
    detail?: string;
  } = {};

  try {
    json = responseText ? JSON.parse(responseText) : {};
  } catch {
    json = {};
  }

  if (!response.ok) {
    throw new Error(
      json.errors?.[0]?.detail ||
        json.detail ||
        json.title ||
        `X API follow check failed (HTTP ${response.status})`,
    );
  }

  const statuses = json.data?.connection_status ?? [];
  return statuses.includes("following");
}
