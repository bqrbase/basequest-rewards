import { NextResponse } from "next/server";
import { linkXAccountToWallet } from "@/lib/supabase/users";
import {
  getAppBaseUrl,
  getXRedirectUri,
  normalizeWalletAddress,
} from "@/lib/x/config";
import {
  exchangeXCodeForToken,
  fetchXAuthenticatedUser,
} from "@/lib/x/api";
import {
  clearOAuthPendingCookie,
  readOAuthPendingCookie,
  setXSessionCookie,
} from "@/lib/x/session";

function redirectWithParams(
  requestUrl: string,
  path: string,
  params: Record<string, string>,
) {
  const base = getAppBaseUrl(requestUrl);
  const url = new URL(path, base);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url);
}

/**
 * GET /api/auth/x/callback
 * Completes X OAuth 2.0, stores session (httpOnly), links X user id to wallet.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  const pending = await readOAuthPendingCookie();
  const returnTo = pending?.returnTo || "/quests";

  try {
    if (oauthError) {
      await clearOAuthPendingCookie();
      return redirectWithParams(request.url, returnTo, {
        x_auth: "error",
        x_error: oauthError,
      });
    }

    if (!code || !state || !pending) {
      await clearOAuthPendingCookie();
      return redirectWithParams(request.url, returnTo, {
        x_auth: "error",
        x_error: "invalid_callback",
      });
    }

    if (state !== pending.state) {
      await clearOAuthPendingCookie();
      return redirectWithParams(request.url, returnTo, {
        x_auth: "error",
        x_error: "state_mismatch",
      });
    }

    const token = await exchangeXCodeForToken({
      code,
      redirectUri: getXRedirectUri(request.url),
      codeVerifier: pending.codeVerifier,
    });

    const xUser = await fetchXAuthenticatedUser(token.access_token);
    const walletAddress = normalizeWalletAddress(pending.walletAddress);
    const expiresAt =
      Date.now() + Math.max(60, token.expires_in ?? 7200) * 1000;

    await setXSessionCookie({
      walletAddress,
      xUserId: xUser.id,
      xUsername: xUser.username,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt,
    });

    await clearOAuthPendingCookie();

    try {
      await linkXAccountToWallet(walletAddress, {
        xUserId: xUser.id,
        xUsername: xUser.username,
      });
    } catch {
      // Session remains valid for verify-follow even if DB link fails.
    }

    return redirectWithParams(request.url, returnTo, {
      x_auth: "connected",
      x_user: xUser.username,
    });
  } catch {
    await clearOAuthPendingCookie();
    return redirectWithParams(request.url, returnTo, {
      x_auth: "error",
      x_error: "callback_failed",
    });
  }
}
