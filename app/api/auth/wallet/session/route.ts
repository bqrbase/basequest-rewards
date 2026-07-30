import { NextResponse } from "next/server";
import { readWalletAuthSessionCookie } from "@/lib/wallet/auth/session";
import {
  isValidWalletAddress,
  normalizeWalletAddress,
} from "@/lib/x/config";

/**
 * GET /api/auth/wallet/session?wallet=0x...
 * Reports whether a valid ownership session exists for the wallet.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get("wallet");

    if (!wallet || !isValidWalletAddress(wallet)) {
      return NextResponse.json(
        { success: false, authenticated: false, error: "valid_wallet_required" },
        { status: 400 },
      );
    }

    const walletAddress = normalizeWalletAddress(wallet);
    const session = await readWalletAuthSessionCookie();
    const authenticated =
      Boolean(session) && session?.walletAddress === walletAddress;

    return NextResponse.json({
      success: true,
      authenticated,
      wallet: authenticated ? walletAddress : null,
      expiresAt: authenticated ? session?.expiresAt ?? null : null,
    });
  } catch (error) {
    console.error("[auth/wallet/session]", error);
    return NextResponse.json(
      {
        success: false,
        authenticated: false,
        error: "wallet_session_check_failed",
      },
      { status: 500 },
    );
  }
}
