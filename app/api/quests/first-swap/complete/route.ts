import { NextResponse } from "next/server";
import {
  completeOneTimeQuest,
  QUEST_DEFINITIONS,
  type QuestProgress,
} from "@/lib/quest-engine";
import { verifyBaseSwapTx } from "@/lib/swap/verifyBaseSwapTx";
import { extractSupabaseError } from "@/lib/supabase/deployedContracts";
import {
  fetchOrCreateUser,
  saveUserProgress,
  userRowToProgress,
} from "@/lib/supabase/users";
import {
  isValidWalletAddress,
  normalizeWalletAddress,
} from "@/lib/x/config";

type CompleteBody = {
  wallet?: string;
  txHash?: string;
};

/**
 * POST /api/quests/first-swap/complete
 * Completes the first-swap quest only after a confirmed successful Base tx.
 */
export async function POST(request: Request) {
  try {
    let body: CompleteBody = {};
    try {
      body = (await request.json()) as CompleteBody;
    } catch {
      return NextResponse.json(
        { success: false, error: "invalid_json" },
        { status: 400 },
      );
    }

    const wallet = body.wallet;
    const txHash = body.txHash;

    if (!wallet || !isValidWalletAddress(wallet)) {
      return NextResponse.json(
        { success: false, error: "valid_wallet_required" },
        { status: 400 },
      );
    }

    if (!txHash || typeof txHash !== "string") {
      return NextResponse.json(
        { success: false, error: "tx_hash_required" },
        { status: 400 },
      );
    }

    const walletAddress = normalizeWalletAddress(wallet);

    const verification = await verifyBaseSwapTx({
      txHash,
      walletAddress,
    });

    if (!verification.ok) {
      return NextResponse.json(
        {
          success: false,
          error: verification.error,
          message: verification.message,
        },
        { status: 400 },
      );
    }

    const user = await fetchOrCreateUser(walletAddress);
    let progress: QuestProgress = user
      ? userRowToProgress(user)
      : {
          totalXp: 0,
          streak: 0,
          lastCheckInDate: null,
          completedQuestIds: [],
        };

    const alreadyCompleted = progress.completedQuestIds.includes("first-swap");

    if (!alreadyCompleted) {
      progress = completeOneTimeQuest(
        progress,
        "first-swap",
        QUEST_DEFINITIONS,
      );

      try {
        await saveUserProgress(walletAddress, progress);
      } catch (progressError) {
        console.error("[first-swap/complete] saveUserProgress", progressError);
      }
    }

    return NextResponse.json({
      success: true,
      alreadyCompleted,
      txHash: verification.txHash.toLowerCase(),
      progress: {
        totalXp: progress.totalXp,
        streak: progress.streak,
        lastCheckInDate: progress.lastCheckInDate,
        completedQuestIds: progress.completedQuestIds,
      },
    });
  } catch (error) {
    const info = extractSupabaseError(error);
    console.error("[first-swap/complete]", {
      code: info.code,
      message: info.message,
      details: info.details,
      hint: info.hint,
      raw: info.raw,
    });
    return NextResponse.json(
      {
        success: false,
        error: info.message,
      },
      { status: 500 },
    );
  }
}
