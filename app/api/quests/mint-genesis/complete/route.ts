import { isHoldingGenesis } from "@/lib/genesis/features";
import { readGenesisHolderBalance } from "@/lib/genesis/holder/server";
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
import { NextResponse } from "next/server";

type CompleteBody = {
  wallet?: string;
};

/**
 * POST /api/quests/mint-genesis/complete
 * Requires wallet ownership + on-chain Genesis ERC-1155 balanceOf(address, 1) > 0.
 * Awards XP once via awardOneTimeQuest.
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

    let balance: bigint;
    try {
      balance = await readGenesisHolderBalance(walletAddress);
    } catch (error) {
      console.error("[mint-genesis/complete] balanceOf failed", error);
      return NextResponse.json(
        {
          success: false,
          error: "genesis_balance_check_failed",
          message: "Unable to verify Genesis NFT ownership on-chain.",
        },
        { status: 502 },
      );
    }

    if (!isHoldingGenesis(balance)) {
      return NextResponse.json(
        {
          success: false,
          error: "genesis_nft_required",
          message:
            "Wallet must own at least one BaseQuest Genesis NFT (token id 1).",
        },
        { status: 400 },
      );
    }

    const { progress, alreadyCompleted, baseXP, bonusXP, awardedXP } =
      await awardOneTimeQuest({
        walletAddress,
        questId: "mint-genesis",
      });

    return NextResponse.json({
      success: true,
      alreadyCompleted,
      baseXP,
      bonusXP,
      awardedXP,
      progress: progressResponse(progress),
    });
  } catch (error) {
    const info = extractSupabaseError(error);
    console.error("[mint-genesis/complete]", {
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
