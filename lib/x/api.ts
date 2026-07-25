import {
  getXClientId,
  getXClientSecret,
  X_TARGET_USERNAME,
} from "@/lib/x/config";

const X_API = "https://api.x.com";
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

/**
 * GET https://api.x.com/2/users/me
 * Requires the authenticated user's OAuth 2.0 access token.
 */
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

/**
 * User-context follow verification for @bqrbase.
 * Uses the authenticated user's OAuth access token only (no app bearer).
 *
 * GET /2/users/by/username/:username?user.fields=connection_status
 * Docs: connection_status includes "following" when the authed user follows them.
 */
export async function doesAuthenticatedUserFollowTarget(
  accessToken: string,
): Promise<boolean> {
  const url = new URL(
    `${X_API}/2/users/by/username/${X_TARGET_USERNAME}`,
  );
  url.searchParams.set("user.fields", "connection_status,username");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
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
    json = responseText ? (JSON.parse(responseText) as typeof json) : {};
  } catch {
    json = {};
  }

  if (!response.ok) {
    throw new Error(
      json.errors?.[0]?.detail ||
        json.detail ||
        json.title ||
        `X API follow check failed (HTTP ${response.status}): ${responseText || "(empty body)"}`,
    );
  }

  const statuses = json.data?.connection_status ?? [];
  return statuses.includes("following");
}
