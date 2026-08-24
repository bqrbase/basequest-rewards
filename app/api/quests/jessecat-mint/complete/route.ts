import { NextResponse } from "next/server";
import { verifyJesseCatMintTransaction } from "@/lib/chain/verifyJesseCatMintTransaction";
import { progressResponse } from "@/lib/quests/awardOneTimeQuest";
import {
  awardJesseCatMintXp,
  JESSECAT_MINT_REWARD_XP,
} from "@/lib/quests/jessecatMintReward";
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
 * POST /api/quests/jessecat-mint/complete
 * Awards +100 XP per confirmed JesseCat mint. Repeatable across tx hashes;
 * the same hash never awards twice. Does not mark the quest completed.
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
    const verification = await verifyJesseCatMintTransaction({
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

    const result = await awardJesseCatMintXp({
      walletAddress,
      txHash: verification.txHash,
    });

    return NextResponse.json({
      success: true,
      alreadyAwarded: result.alreadyAwarded,
      alreadyCompleted: false,
      txHash: verification.txHash.toLowerCase(),
      baseXP: JESSECAT_MINT_REWARD_XP,
      bonusXP: 0,
      awardedXP: result.awardedXP,
      progress: progressResponse(result.progress),
    });
  } catch (error) {
    const info = extractSupabaseError(error);
    console.error("[jessecat-mint/complete]", {
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
