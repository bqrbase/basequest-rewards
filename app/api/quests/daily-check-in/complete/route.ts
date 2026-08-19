import { NextResponse } from "next/server";
import { DAILY_CHECK_IN_ADDRESS } from "@/lib/contracts/DailyCheckIn";
import { CHECK_IN_SELECTOR } from "@/lib/chain/questContracts";
import { verifyBaseTransactionWithRetry } from "@/lib/chain/verifyBaseTransaction";
import {
  awardOneTimeQuest,
  progressResponse,
} from "@/lib/quests/awardOneTimeQuest";
import {
  isValidWalletAddress,
  normalizeWalletAddress,
} from "@/lib/x/config";

type CompleteBody = {
  wallet?: string;
  txHash?: string;
};

/**
 * POST /api/quests/daily-check-in/complete
 * Awards Daily Check-in XP only after on-chain verification of checkIn().
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
        { success: false, error: "valid_tx_hash_required" },
        { status: 400 },
      );
    }

    const walletAddress = normalizeWalletAddress(wallet);
    const verification = await verifyBaseTransactionWithRetry({
      txHash,
      walletAddress,
      expectedTo: DAILY_CHECK_IN_ADDRESS,
      expectedFunctionSelector: CHECK_IN_SELECTOR,
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

    const result = await awardOneTimeQuest({
      walletAddress,
      questId: "daily-check-in",
    });

    return NextResponse.json({
      success: true,
      alreadyCompleted: result.alreadyCompleted,
      baseXP: result.baseXP,
      bonusXP: result.bonusXP,
      awardedXP: result.awardedXP,
      txHash: verification.txHash,
      progress: progressResponse(result.progress),
    });
  } catch (error) {
    console.error("[quests/daily-check-in/complete]", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "daily_check_in_complete_failed",
      },
      { status: 500 },
    );
  }
}
