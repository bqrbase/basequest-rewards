import { NextResponse } from "next/server";
import {
  createCodeChallenge,
  createCodeVerifier,
  createOAuthState,
  getAppBaseUrl,
  getXClientId,
  getXRedirectUri,
  isValidWalletAddress,
  normalizeWalletAddress,
} from "@/lib/x/config";
import { buildXAuthorizeUrl } from "@/lib/x/api";
import {
  readXSessionCookie,
  setOAuthPendingCookie,
} from "@/lib/x/session";

function safeReturnTo(value: string | null, requestUrl: string): string {
  const fallback = "/quests";
  if (!value) {
    return fallback;
  }

  // Only allow relative in-app paths.
  if (!value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  try {
    const base = getAppBaseUrl(requestUrl);
    const resolved = new URL(value, base);
    if (resolved.origin !== new URL(base).origin) {
      return fallback;
    }
    return `${resolved.pathname}${resolved.search}`;
  } catch {
    return fallback;
  }
}

/**
 * GET /api/auth/x/login?wallet=0x...&returnTo=/quests
 * Starts X OAuth 2.0 (PKCE). Secrets never leave the server.
 *
 * Optional: ?check=1 returns connection status JSON without redirecting.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get("wallet");
    const check = searchParams.get("check") === "1";

    if (!wallet || !isValidWalletAddress(wallet)) {
      return NextResponse.json(
        { error: "valid_wallet_required" },
        { status: 400 },
      );
    }

    const walletAddress = normalizeWalletAddress(wallet);

    if (check) {
      const session = await readXSessionCookie();
      const connected =
        Boolean(session) &&
        normalizeWalletAddress(session!.walletAddress) === walletAddress;

      return NextResponse.json({
        connected,
        username: connected ? session!.xUsername : null,
        xUserId: connected ? session!.xUserId : null,
      });
    }

    const clientId = getXClientId();
    const redirectUri = getXRedirectUri(request.url);
    const state = createOAuthState();
    const codeVerifier = createCodeVerifier();
    const codeChallenge = await createCodeChallenge(codeVerifier);
    const returnTo = safeReturnTo(searchParams.get("returnTo"), request.url);

    await setOAuthPendingCookie({
      state,
      codeVerifier,
      walletAddress,
      returnTo,
    });

    const authorizeUrl = buildXAuthorizeUrl({
      clientId,
      redirectUri,
      state,
      codeChallenge,
    });

    return NextResponse.redirect(authorizeUrl);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
