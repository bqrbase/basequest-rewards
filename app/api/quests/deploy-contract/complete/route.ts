import { NextResponse } from "next/server";
import {
  awardOneTimeQuest,
  progressResponse,
} from "@/lib/quests/awardOneTimeQuest";
import { enforceWalletOwnership } from "@/lib/quests/enforceWalletOwnership";
import { extractSupabaseError } from "@/lib/supabase/deployedContracts";
import { loadProgressAdmin } from "@/lib/supabase/usersServer";
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
 * Awards Deploy Contract XP at most once per UTC day (Genesis bonus when eligible).
 * Already-rewarded-today is a successful 200 with awardedXP = 0 — never an error.
 * Requires wallet ownership. Contract persistence: POST /api/contracts/save.
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
        baseXP,
        bonusXP,
        awardedXP,
        progress: progressResponse(progress),
      });
    } catch (awardError) {
      // Never fail the deploy success UX for reward bookkeeping issues.
      // Return current progress with 0 XP awarded.
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
