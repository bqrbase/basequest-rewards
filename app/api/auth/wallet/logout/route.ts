import { NextResponse } from "next/server";
import { clearWalletAuthCookies } from "@/lib/wallet/auth/session";

/**
 * POST /api/auth/wallet/logout
 * Clears wallet ownership session cookies.
 */
export async function POST() {
  try {
    await clearWalletAuthCookies();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[auth/wallet/logout]", error);
    return NextResponse.json(
      { success: false, error: "wallet_logout_failed" },
      { status: 500 },
    );
  }
}
