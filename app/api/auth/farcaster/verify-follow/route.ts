import { NextResponse } from "next/server";
import { FARCASTER_FOLLOW_QUEST_TARGET } from "@/lib/community-quests";
import {
  doesFidFollowTarget,
  lookupFidByWalletAddress,
} from "@/lib/farcaster/neynar";
import {
  completeOneTimeQuest,
  QUEST_DEFINITIONS,
  type QuestProgress,
} from "@/lib/quest-engine";
import {
  fetchOrCreateUser,
  saveUserProgress,
  userRowToProgress,
} from "@/lib/supabase/users";
import {
  isValidWalletAddress,
  normalizeWalletAddress,
} from "@/lib/x/config";

type VerifyBody = {
  wallet?: string;
  /** Connected Farcaster FID from Mini App / client context. */
  fid?: number;
};

/**
 * POST /api/auth/farcaster/verify-follow
 * Body: { wallet: "0x...", fid?: number }
 *
 * Uses Neynar viewer_context to check whether the user follows @hqc (FID 368591).
 */
export async function POST(request: Request) {
  try {
    let body: VerifyBody = {};
    try {
      body = (await request.json()) as VerifyBody;
    } catch {
      return NextResponse.json(
        { success: false, error: "invalid_json" },
        { status: 400 },
      );
    }

    const wallet = body.wallet;
    if (!wallet || !isValidWalletAddress(wallet)) {
      return NextResponse.json(
        { success: false, error: "Connect your wallet to verify." },
        { status: 400 },
      );
    }

    const walletAddress = normalizeWalletAddress(wallet);
    const bodyFid =
      typeof body.fid === "number" && Number.isFinite(body.fid) && body.fid > 0
        ? Math.floor(body.fid)
        : null;

    let viewerFid = bodyFid;

    if (!viewerFid) {
      viewerFid = await lookupFidByWalletAddress(walletAddress);
    }

    if (!viewerFid) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Could not read your Farcaster FID. Open BaseQuest in Farcaster/Base App, or use a wallet linked to Farcaster.",
        },
        { status: 400 },
      );
    }

    const following = await doesFidFollowTarget({
      viewerFid,
      targetFid: FARCASTER_FOLLOW_QUEST_TARGET.fid,
      targetUsername: FARCASTER_FOLLOW_QUEST_TARGET.username,
    });

    if (!following) {
      return NextResponse.json({
        success: false,
        error: "Please follow @hqc first.",
      });
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

    const alreadyCompleted =
      progress.completedQuestIds.includes("follow-farcaster");

    if (!alreadyCompleted) {
      progress = completeOneTimeQuest(
        progress,
        "follow-farcaster",
        QUEST_DEFINITIONS,
      );

      try {
        await saveUserProgress(walletAddress, progress);
      } catch (saveError) {
        console.error("[farcaster/verify-follow] saveUserProgress", saveError);
      }
    }

    return NextResponse.json({
      success: true,
      alreadyCompleted,
      fid: viewerFid,
      progress: {
        totalXp: progress.totalXp,
        streak: progress.streak,
        lastCheckInDate: progress.lastCheckInDate,
        completedQuestIds: progress.completedQuestIds,
      },
    });
  } catch (error) {
    console.error("[farcaster/verify-follow] failed", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
