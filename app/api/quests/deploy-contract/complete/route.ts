import { NextResponse } from "next/server";
import {
  awardOneTimeQuest,
  progressResponse,
} from "@/lib/quests/awardOneTimeQuest";
import { verifyBaseTransactionWithRetry } from "@/lib/chain/verifyBaseTransaction";
import { extractSupabaseError } from "@/lib/supabase/deployedContracts";
import { loadProgressAdmin } from "@/lib/supabase/usersServer";
import {
  isValidWalletAddress,
  normalizeWalletAddress,
} from "@/lib/x/config";

type CompleteBody = {
  wallet?: string;
  contractAddress?: string;
  txHash?: string;
};

/**
 * POST /api/quests/deploy-contract/complete
 * Awards Deploy Contract XP after verifying the deploy transaction on Base.
 * Already-rewarded-today is a successful 200 with awardedXP = 0.
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
    const contractAddress = body.contractAddress;
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
      allowContractCreation: true,
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

    try {
      const { progress, alreadyCompleted, baseXP, bonusXP, awardedXP } =
        await awardOneTimeQuest({
          walletAddress,
          questId: "deploy-contract",
        });

      return NextResponse.json({
        success: true,
        alreadyCompleted,
        alreadyRewardedToday: alreadyCompleted,
        contractAddress: contractAddress?.toLowerCase() ?? null,
        txHash: verification.txHash,
        baseXP,
        bonusXP,
        awardedXP,
        progress: progressResponse(progress),
      });
    } catch (awardError) {
      const info = extractSupabaseError(awardError);
      console.error("[deploy-contract/complete] award failed (soft)", {
        code: info.code,
        message: info.message,
        details: info.details,
        hint: info.hint,
      });

      const progress = await loadProgressAdmin(walletAddress);
      return NextResponse.json({
        success: true,
        alreadyCompleted: true,
        alreadyRewardedToday: true,
        contractAddress: contractAddress?.toLowerCase() ?? null,
        txHash: verification.txHash,
        baseXP: 0,
        bonusXP: 0,
        awardedXP: 0,
        progress: progressResponse(progress),
        warning: info.message,
      });
    }
  } catch (error) {
    const info = extractSupabaseError(error);
    console.error("[deploy-contract/complete]", {
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
