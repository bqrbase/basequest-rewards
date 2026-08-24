import { joinTask } from "@/lib/task2earn/server";
import {
  isValidWalletAddress,
  normalizeWalletAddress,
} from "@/lib/x/config";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

type JoinBody = {
  wallet?: string;
  fid?: unknown;
};

/**
 * POST /api/tasks/:id/join
 * Creates a participant row only. No XP, BQR, USDC, ETH, or claims.
 * Ignores client-provided FID; resolves FID from the wallet via Neynar.
 * Wallet follows the existing progress/sync body pattern.
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

    let body: JoinBody = {};
    try {
      body = (await request.json()) as JoinBody;
    } catch {
      return NextResponse.json(
        { success: false, error: "invalid_json" },
        { status: 400 },
      );
    }

    void body.fid;

    const wallet = body.wallet;
    if (!wallet || !isValidWalletAddress(wallet)) {
      return NextResponse.json(
        { success: false, error: "valid_wallet_required" },
        { status: 400 },
      );
    }

    const result = await joinTask({
      taskId: id,
      walletAddress: normalizeWalletAddress(wallet),
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json({
      success: true,
      alreadyJoined: result.alreadyJoined,
      participant: result.participant,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "join_failed";
    if (message === "task2earn_unavailable") {
      return NextResponse.json(
        { success: false, error: "unavailable" },
        { status: 503 },
      );
    }
    console.error("[api/tasks/id/join] POST failed", error);
    return NextResponse.json(
      { success: false, error: "join_failed" },
      { status: 500 },
    );
  }
}
