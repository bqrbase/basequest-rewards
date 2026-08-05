/**
 * POST /api/quests/complete — soft quests only (no on-chain proof).
 * On-chain quests must use dedicated endpoints with transaction verification.
 * Wallet ownership cookies / personal_sign sessions are not used.
 */
import { NextResponse } from "next/server";
import {
  awardOneTimeQuest,
  progressResponse,
} from "@/lib/quests/awardOneTimeQuest";
import { QUEST_IDS, type QuestId } from "@/lib/quest-engine";
import {
  isValidWalletAddress,
  normalizeWalletAddress,
} from "@/lib/x/config";

type CompleteBody = {
  wallet?: string;
  questId?: string;
};

/** Soft quests without an on-chain transaction (low-value / UX quests). */
const SOFT_QUESTS = new Set<QuestId>([
  "view-leaderboard",
  "build-streak",
  "explore-base",
]);

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
    const questId = body.questId;

    if (!wallet || !isValidWalletAddress(wallet)) {
      return NextResponse.json(
        { success: false, error: "valid_wallet_required" },
        { status: 400 },
      );
    }

    if (
      !questId ||
      typeof questId !== "string" ||
      !QUEST_IDS.includes(questId as QuestId)
    ) {
      return NextResponse.json(
        { success: false, error: "valid_quest_id_required" },
        { status: 400 },
      );
    }

    const typedQuestId = questId as QuestId;

    if (typedQuestId === "daily-check-in") {
      return NextResponse.json(
        {
          success: false,
          error: "quest_requires_dedicated_endpoint",
          message:
            "Daily Check-in must be completed via /api/quests/daily-check-in/complete with a verified txHash.",
        },
        { status: 400 },
      );
    }

    if (!SOFT_QUESTS.has(typedQuestId)) {
      return NextResponse.json(
        {
          success: false,
          error: "quest_requires_dedicated_endpoint",
          message:
            "This quest must be completed through its verified proof endpoint.",
        },
        { status: 400 },
      );
    }

    const walletAddress = normalizeWalletAddress(wallet);
    const result = await awardOneTimeQuest({
      walletAddress,
      questId: typedQuestId,
    });

    return NextResponse.json({
      success: true,
      alreadyCompleted: result.alreadyCompleted,
      baseXP: result.baseXP,
      bonusXP: result.bonusXP,
      awardedXP: result.awardedXP,
      progress: progressResponse(result.progress),
    });
  } catch (error) {
    console.error("[quests/complete]", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "quest_complete_failed",
      },
      { status: 500 },
    );
  }
}
