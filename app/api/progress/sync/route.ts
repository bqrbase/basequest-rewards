import { NextResponse } from "next/server";
import { requireWalletOwnership } from "@/lib/wallet/auth/verifyOwnership";
import {
  fetchOrCreateUserAdmin,
} from "@/lib/supabase/usersServer";
import { userRowToProgress } from "@/lib/supabase/users";
import { progressResponse } from "@/lib/quests/awardOneTimeQuest";
import {
  isValidWalletAddress,
  normalizeWalletAddress,
} from "@/lib/x/config";

type SyncBody = {
  wallet?: string;
};

/**
 * POST /api/progress/sync
 * Loads (or creates) authoritative server progress for a verified wallet.
 * Client must not write XP directly — this is the read/create entrypoint.
 */
export async function POST(request: Request) {
  try {
    let body: SyncBody = {};
    try {
      body = (await request.json()) as SyncBody;
    } catch {
      return NextResponse.json(
        { success: false, error: "invalid_json" },
        { status: 400 },
      );
    }

    const wallet = body.wallet;
    if (!wallet || !isValidWalletAddress(wallet)) {
      return NextResponse.json(
        { success: false, error: "valid_wallet_required" },
        { status: 400 },
      );
    }

    const walletAddress = normalizeWalletAddress(wallet);
    const ownership = await requireWalletOwnership(walletAddress);
    if (!ownership.ok) {
      return NextResponse.json(
        {
          success: false,
          error: ownership.error,
          message: ownership.message,
        },
        { status: 401 },
      );
    }

    const user = await fetchOrCreateUserAdmin(walletAddress);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "user_unavailable" },
        { status: 503 },
      );
    }

    const progress = userRowToProgress(user);

    return NextResponse.json({
      success: true,
      progress: progressResponse(progress),
    });
  } catch (error) {
    console.error("[progress/sync]", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "progress_sync_failed",
      },
      { status: 500 },
    );
  }
}
