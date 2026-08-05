import { NextResponse } from "next/server";
import { FARCASTER_FOLLOW_QUEST_TARGET } from "@/lib/community-quests";
import {
  doesFidFollowTarget,
  lookupFidByWalletAddress,
} from "@/lib/farcaster/neynar";
import {
  awardOneTimeQuest,
  progressResponse,
} from "@/lib/quests/awardOneTimeQuest";
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
 * Prefers FID resolved from the wallet when possible (no wallet signature session).
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

    // Prefer wallet→FID lookup so clients cannot spoof an arbitrary FID.
    const linkedFid = await lookupFidByWalletAddress(walletAddress);
    const viewerFid = linkedFid ?? bodyFid;

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

    if (linkedFid && bodyFid && linkedFid !== bodyFid) {
      return NextResponse.json(
        {
          success: false,
          error: "Farcaster FID does not match the connected wallet.",
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

    const { progress, alreadyCompleted, baseXP, bonusXP, awardedXP } =
      await awardOneTimeQuest({
        walletAddress,
        questId: "follow-farcaster",
      });

    return NextResponse.json({
      success: true,
      alreadyCompleted,
      fid: viewerFid,
      baseXP,
      bonusXP,
      awardedXP,
      progress: progressResponse(progress),
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
