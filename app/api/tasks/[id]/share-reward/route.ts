import { creditShareCastReward } from "@/lib/task2earn/share-reward";
import {
  isValidWalletAddress,
  normalizeWalletAddress,
} from "@/lib/x/config";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/tasks/:id/share-reward
 * Credits 25 off-chain BQR after server-side Farcaster Share Cast proof.
 * Ignores client amount, FID, shared flags, and treats castHash as a hint only.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: "task_id_required" },
        { status: 400 },
      );
    }

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
    void record.amount;
    void record.amountBqr;
    void record.reward;
    void record.fid;
    void record.creatorFid;
    void record.creator_fid;
    void record.shared;
    void record.completed;

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

    const result = await creditShareCastReward({
      taskId: id,
      walletAddress: normalizeWalletAddress(walletRaw),
      castHashHint,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          reason: result.reason ?? null,
        },
        { status: result.status },
      );
    }

    return NextResponse.json({
      success: true,
      alreadyCredited: result.alreadyCredited,
      amountBqr: result.amountBqr,
      earnedBqr: result.earnedBqr,
      claimId: result.claimId,
      castHash: result.castHash,
      label: result.label,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "share_reward_failed";
    if (message === "task2earn_unavailable") {
      return NextResponse.json(
        { success: false, error: "unavailable" },
        { status: 503 },
      );
    }
    console.error("[api/tasks/id/share-reward] POST failed", error);
    return NextResponse.json(
      { success: false, error: "share_reward_failed" },
      { status: 500 },
    );
  }
}
