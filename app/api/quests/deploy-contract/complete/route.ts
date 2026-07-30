import { NextResponse } from "next/server";
import {
  awardOneTimeQuest,
  progressResponse,
} from "@/lib/quests/awardOneTimeQuest";
import { enforceWalletOwnership } from "@/lib/quests/enforceWalletOwnership";
import { extractSupabaseError } from "@/lib/supabase/deployedContracts";
import {
  isValidWalletAddress,
  normalizeWalletAddress,
} from "@/lib/x/config";

type CompleteBody = {
  wallet?: string;
  contractAddress?: string;
};

/**
 * POST /api/quests/deploy-contract/complete
 * Completes the deploy-contract quest and awards XP (with Genesis bonus when eligible).
 * Requires wallet ownership session. Contract persistence: POST /api/contracts/save.
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

    if (!wallet || !isValidWalletAddress(wallet)) {
      return NextResponse.json(
        { success: false, error: "valid_wallet_required" },
        { status: 400 },
      );
    }

    const walletAddress = normalizeWalletAddress(wallet);
    const ownership = await enforceWalletOwnership(walletAddress);
    if (!ownership.ok) {
      return ownership.response;
    }

    const { progress, alreadyCompleted, baseXP, bonusXP, awardedXP } =
      await awardOneTimeQuest({
        walletAddress,
        questId: "deploy-contract",
      });

    return NextResponse.json({
      success: true,
      alreadyCompleted,
      contractAddress: contractAddress?.toLowerCase() ?? null,
      baseXP,
      bonusXP,
      awardedXP,
      progress: progressResponse(progress),
    });
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
