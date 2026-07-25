import { NextResponse } from "next/server";
import {
  completeOneTimeQuest,
  QUEST_DEFINITIONS,
  type QuestProgress,
} from "@/lib/quest-engine";
import {
  fetchOrCreateUser,
  saveUserProgress,
  saveXFollowVerification,
  userRowToProgress,
} from "@/lib/supabase/users";
import {
  isValidWalletAddress,
  normalizeWalletAddress,
} from "@/lib/x/config";
import {
  doesUserFollowTarget,
  fetchTargetXUserId,
} from "@/lib/x/api";
import { readXSessionCookie } from "@/lib/x/session";

type VerifyBody = {
  wallet?: string;
};

function progressPayload(progress: QuestProgress) {
  return {
    totalXp: progress.totalXp,
    streak: progress.streak,
    lastCheckInDate: progress.lastCheckInDate,
    completedQuestIds: progress.completedQuestIds,
  };
}

/**
 * POST /api/auth/x/verify-follow
 * Body: { wallet: "0x..." }
 *
 * Official X OAuth session + X API v2 follow verification for @bqrbase.
 * On success:
 * - stores twitter_user_id + x_follow_verified_at in Supabase
 * - completes follow-x quest and awards XP exactly once
 *
 * Already-completed quests short-circuit (one-time): unfollow after claim
 * does not revoke completion or allow duplicate XP.
 */
export async function POST(request: Request) {
  try {
    let body: VerifyBody = {};
    try {
      body = (await request.json()) as VerifyBody;
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }

    const wallet = body.wallet;
    if (!wallet || !isValidWalletAddress(wallet)) {
      return NextResponse.json(
        { error: "valid_wallet_required" },
        { status: 400 },
      );
    }

    const walletAddress = normalizeWalletAddress(wallet);

    let user;
    try {
      user = await fetchOrCreateUser(walletAddress);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to load user progress",
        },
        { status: 500 },
      );
    }

    let progress: QuestProgress = user
      ? userRowToProgress(user)
      : {
          totalXp: 0,
          streak: 0,
          lastCheckInDate: null,
          completedQuestIds: [],
        };

    // One-time quest: keep completed even if user later unfollows.
    if (progress.completedQuestIds.includes("follow-x")) {
      return NextResponse.json({
        status: "completed",
        alreadyCompleted: true,
        twitterUserId: user?.twitter_user_id ?? user?.x_user_id ?? null,
        verifiedAt: user?.x_follow_verified_at ?? null,
        progress: progressPayload(progress),
        xUsername: user?.x_username ?? null,
      });
    }

    const session = await readXSessionCookie();
    if (
      !session ||
      normalizeWalletAddress(session.walletAddress) !== walletAddress
    ) {
      return NextResponse.json(
        { error: "not_authenticated", status: "not_authenticated" },
        { status: 401 },
      );
    }

    const targetUserId = await fetchTargetXUserId();
    const following = await doesUserFollowTarget({
      accessToken: session.accessToken,
      sourceUserId: session.xUserId,
      targetUserId,
    });

    if (!following) {
      return NextResponse.json({
        error: "not_following",
        status: "not_following",
      });
    }

    const verifiedAt = new Date().toISOString();

    try {
      await saveXFollowVerification(walletAddress, {
        twitterUserId: session.xUserId,
        xUsername: session.xUsername,
        verifiedAt,
      });
    } catch (verifySaveError) {
      return NextResponse.json(
        {
          error:
            verifySaveError instanceof Error
              ? verifySaveError.message
              : "Failed to store X follow verification",
        },
        { status: 500 },
      );
    }

    progress = completeOneTimeQuest(
      progress,
      "follow-x",
      QUEST_DEFINITIONS,
    );

    try {
      await saveUserProgress(walletAddress, progress);
    } catch (saveError) {
      return NextResponse.json(
        {
          error:
            saveError instanceof Error
              ? saveError.message
              : "Failed to save quest progress",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      status: "completed",
      alreadyCompleted: false,
      twitterUserId: session.xUserId,
      verifiedAt,
      progress: progressPayload(progress),
      xUsername: session.xUsername,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
