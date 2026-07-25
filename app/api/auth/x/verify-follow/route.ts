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
  doesAuthenticatedUserFollowTarget,
  fetchXAuthenticatedUser,
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
        twitterUserId: user?.twitter_user_id ?? null,
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

    // Official flow: /2/users/me → /2/users/{id}/following → username "bqrbase".
    const xUser = await fetchXAuthenticatedUser(session.accessToken);
    const following = await doesAuthenticatedUserFollowTarget(
      session.accessToken,
      xUser.id,
    );

    if (!following) {
      return NextResponse.json({
        error: "not_following",
        status: "not_following",
      });
    }

    const verifiedAt = new Date().toISOString();

    try {
      await saveXFollowVerification(walletAddress, {
        twitterUserId: xUser.id,
        xUsername: xUser.username,
        verifiedAt,
      });
    } catch (verifySaveError) {
      const supabaseError =
        verifySaveError && typeof verifySaveError === "object"
          ? (verifySaveError as {
              code?: string;
              message?: string;
              details?: string;
              hint?: string;
            })
          : null;

      const code = supabaseError?.code ?? null;
      const message =
        supabaseError?.message ??
        (verifySaveError instanceof Error
          ? verifySaveError.message
          : String(verifySaveError));
      const details = supabaseError?.details ?? null;
      const hint = supabaseError?.hint ?? null;

      console.error("[x/verify-follow] saveXFollowVerification failed", {
        code,
        message,
        details,
        hint,
      });

      return NextResponse.json(
        {
          error: "Failed to store X follow verification",
          code,
          message,
          details,
          hint,
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
      twitterUserId: xUser.id,
      verifiedAt,
      progress: progressPayload(progress),
      xUsername: xUser.username,
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
