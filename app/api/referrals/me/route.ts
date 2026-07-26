import { getReferralDashboard } from "@/lib/referrals/server";
import {
  isValidWalletAddress,
  normalizeWalletAddress,
} from "@/lib/x/config";
import { NextResponse } from "next/server";

function resolveOrigin(request: Request): string {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedHost) {
    return `${forwardedProto ?? "https"}://${forwardedHost}`;
  }
  return url.origin;
}

/**
 * GET /api/referrals/me?wallet=0x...
 * Returns (or creates) the wallet's referral code, link, and stats.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get("wallet");

    if (!wallet || !isValidWalletAddress(wallet)) {
      return NextResponse.json(
        { error: "valid_wallet_required" },
        { status: 400 },
      );
    }

    const dashboard = await getReferralDashboard(
      normalizeWalletAddress(wallet),
      resolveOrigin(request),
    );

    return NextResponse.json(dashboard);
  } catch (error) {
    console.error("[api/referrals/me]", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
