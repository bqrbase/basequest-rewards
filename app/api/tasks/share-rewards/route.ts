import {
  getShareRewardsCampaign,
  verifyDailyShareReward,
} from "@/lib/task2earn/share-reward";
import { T2E_EARNED_BQR_LABEL } from "@/lib/task2earn/constants";
import {
  isValidWalletAddress,
  normalizeWalletAddress,
} from "@/lib/x/config";
import { NextResponse } from "next/server";

/**
 * GET /api/tasks/share-rewards?wallet=0x...
 * BQR Share Rewards campaign on My Stats. Does not require a Task2Earn task.
 */
export async function GET(request: Request) {
  try {
    const walletRaw = new URL(request.url).searchParams.get("wallet");
    const wallet =
      walletRaw && isValidWalletAddress(walletRaw)
        ? normalizeWalletAddress(walletRaw)
        : null;
    const campaign = await getShareRewardsCampaign(wallet);
    return NextResponse.json({
      success: true,
      label: T2E_EARNED_BQR_LABEL,
      campaign,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "share_rewards_failed";
    if (message === "task2earn_unavailable") {
      return NextResponse.json(
        { success: false, error: "unavailable" },
        { status: 503 },
      );
    }
    console.error("[api/tasks/share-rewards] GET failed", error);
    return NextResponse.json(
      { success: false, error: "share_rewards_failed" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/tasks/share-rewards
 * Verifies a Farcaster share of the Mini App. No task create/join required.
 */
export async function POST(request: Request) {
  try {
    let body: unknown = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const record =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};
    const walletRaw =
      typeof record.wallet === "string"
        ? record.wallet
        : typeof record.walletAddress === "string"
          ? record.walletAddress
          : "";
    if (!walletRaw || !isValidWalletAddress(walletRaw)) {
      return NextResponse.json(
        { success: false, error: "valid_wallet_required" },
        { status: 400 },
      );
    }

    const castHashHint =
      typeof record.castHash === "string"
        ? record.castHash
        : typeof record.hash === "string"
          ? record.hash
          : null;

    const result = await verifyDailyShareReward({
      walletAddress: normalizeWalletAddress(walletRaw),
      castHashHint,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          reason: result.reason ?? null,
          campaign: result.campaign ?? null,
        },
        { status: result.status },
      );
    }

    return NextResponse.json({
      success: true,
      alreadyClaimed: result.alreadyClaimed,
      verified: result.verified,
      campaign: result.campaign,
      castHash: result.castHash,
      qualifiedOnchain: result.qualifiedOnchain,
      label: T2E_EARNED_BQR_LABEL,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "share_rewards_failed";
    if (message === "task2earn_unavailable") {
      return NextResponse.json(
        { success: false, error: "unavailable" },
        { status: 503 },
      );
    }
    console.error("[api/tasks/share-rewards] POST failed", error);
    return NextResponse.json(
      { success: false, error: "share_rewards_failed" },
      { status: 500 },
    );
  }
}
