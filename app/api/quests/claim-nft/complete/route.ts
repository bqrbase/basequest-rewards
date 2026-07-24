import { NextResponse } from "next/server";
import {
  completeOneTimeQuest,
  QUEST_DEFINITIONS,
  type QuestProgress,
} from "@/lib/quest-engine";
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
  contractAddress?: string;
  tokenId?: string;
};

/**
 * POST /api/quests/claim-nft/complete
 * Completes the claim-nft quest and awards XP.
 * NFT persistence is handled by POST /api/nfts/claim/save.
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
    const tokenId = body.tokenId;

    if (!wallet || !isValidWalletAddress(wallet)) {
      return NextResponse.json(
        { success: false, error: "valid_wallet_required" },
        { status: 400 },
      );
    }

    const walletAddress = normalizeWalletAddress(wallet);

    const user = await fetchOrCreateUser(walletAddress);
    let progress: QuestProgress = user
      ? userRowToProgress(user)
      : {
          totalXp: 0,
          streak: 0,
          lastCheckInDate: null,
          completedQuestIds: [],
        };

    if (!progress.completedQuestIds.includes("deploy-contract")) {
      return NextResponse.json(
        {
          success: false,
          error: "deploy_contract_required",
        },
        { status: 400 },
      );
    }

    const alreadyCompleted = progress.completedQuestIds.includes("claim-nft");

    if (!alreadyCompleted) {
      progress = completeOneTimeQuest(
        progress,
        "claim-nft",
        QUEST_DEFINITIONS,
      );

      try {
        await saveUserProgress(walletAddress, progress);
      } catch (progressError) {
        console.error("[claim-nft/complete] saveUserProgress", progressError);
      }
    }

    return NextResponse.json({
      success: true,
      alreadyCompleted,
      contractAddress: contractAddress?.toLowerCase() ?? null,
      tokenId: tokenId ?? null,
      progress: {
        totalXp: progress.totalXp,
        streak: progress.streak,
        lastCheckInDate: progress.lastCheckInDate,
        completedQuestIds: progress.completedQuestIds,
      },
    });
  } catch (error) {
    const info = extractSupabaseError(error);
    console.error("[claim-nft/complete]", {
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
