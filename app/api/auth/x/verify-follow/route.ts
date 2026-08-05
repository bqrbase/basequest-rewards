import { NextResponse } from "next/server";
import {
  awardOneTimeQuest,
  progressResponse,
} from "@/lib/quests/awardOneTimeQuest";
import { saveXFollowVerification } from "@/lib/supabase/users";
import { loadProgressAdmin } from "@/lib/supabase/usersServer";
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

/**
 * POST /api/auth/x/verify-follow
 * Requires X OAuth session bound to the same wallet (no wallet signature session).
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
    const progressBefore = await loadProgressAdmin(walletAddress);

    // One-time quest: keep completed even if user later unfollows.
    if (progressBefore.completedQuestIds.includes("follow-x")) {
      return NextResponse.json({
        status: "completed",
        alreadyCompleted: true,
        progress: progressResponse(progressBefore),
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

      return NextResponse.json(
        {
          error: "Failed to store X follow verification",
          code: supabaseError?.code ?? null,
          message:
            supabaseError?.message ??
            (verifySaveError instanceof Error
              ? verifySaveError.message
              : String(verifySaveError)),
          details: supabaseError?.details ?? null,
          hint: supabaseError?.hint ?? null,
        },
        { status: 500 },
      );
    }

    const { progress, alreadyCompleted, baseXP, bonusXP, awardedXP } =
      await awardOneTimeQuest({
        walletAddress,
        questId: "follow-x",
      });

    return NextResponse.json({
      status: "completed",
      alreadyCompleted,
      twitterUserId: xUser.id,
      verifiedAt,
      baseXP,
      bonusXP,
      awardedXP,
      progress: progressResponse(progress),
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
