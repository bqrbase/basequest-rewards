import { getTopReferrers } from "@/lib/referrals/server";
import { NextResponse } from "next/server";

/**
 * GET /api/referrals/leaderboard
 * Top referrers by successful referral count.
 */
export async function GET() {
  try {
    const entries = await getTopReferrers(50);
    return NextResponse.json({ entries });
  } catch (error) {
    console.error("[api/referrals/leaderboard]", error);
    return NextResponse.json({ error: "server_error", entries: [] }, {
      status: 500,
    });
  }
}
