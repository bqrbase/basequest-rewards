import { NextResponse } from "next/server";
import {
  awardOneTimeQuest,
  progressResponse,
} from "@/lib/quests/awardOneTimeQuest";
import { verifyBaseSwapTx } from "@/lib/swap/verifyBaseSwapTx";
import { extractSupabaseError } from "@/lib/supabase/deployedContracts";
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

    const { progress, alreadyCompleted } = await awardOneTimeQuest({
      walletAddress,
      questId: "first-swap",
    });

    return NextResponse.json({
      success: true,
      alreadyCompleted,
      txHash: verification.txHash.toLowerCase(),
      progress: progressResponse(progress),
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
