import { getPendingRewardsForWallet } from "@/lib/rewards/server/pendingService";
import {
  isValidWalletAddress,
  normalizeWalletAddress,
} from "@/lib/x/config";
import { NextResponse } from "next/server";

/**
 * GET /api/rewards/pending?wallet=0x...
 * Eligibility + published claimable allocations for a wallet.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get("wallet");
    const sync = searchParams.get("sync");

    if (!wallet || !isValidWalletAddress(wallet)) {
      return NextResponse.json(
        { error: "valid_wallet_required" },
        { status: 400 },
      );
    }

    const result = await getPendingRewardsForWallet(
      normalizeWalletAddress(wallet),
      { syncClaims: sync !== "0" && sync !== "false" },
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("[api/rewards/pending]", error);
    const message =
      error instanceof Error ? error.message : "server_error";
    if (message.includes("Supabase admin")) {
      return NextResponse.json(
        { error: "supabase_admin_required" },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
