import { verifyTaskParticipant } from "@/lib/task2earn/verification";
import { toPublicChecks } from "@/lib/task2earn/verification-logic";
import {
  isValidWalletAddress,
  normalizeWalletAddress,
} from "@/lib/x/config";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

type VerifyBody = {
  wallet?: string;
  walletAddress?: string;
  fid?: unknown;
  evidence?: unknown;
  castHash?: unknown;
  liked?: unknown;
  recasted?: unknown;
  completed?: unknown;
};

/**
 * POST /api/tasks/:id/verify
 * Server-side Task2Earn verification. Off-chain only: no payouts, claims, or transfers.
 * Client FID, hashes, audience numbers, and "completed" flags are ignored.
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

    let body: VerifyBody = {};
    try {
      body = (await request.json()) as VerifyBody;
    } catch {
      return NextResponse.json(
        { success: false, error: "invalid_json" },
        { status: 400 },
      );
    }

    void body.fid;
    void body.evidence;
    void body.castHash;
    void body.liked;
    void body.recasted;
    void body.completed;

    const wallet = body.wallet ?? body.walletAddress;
    if (!wallet || !isValidWalletAddress(wallet)) {
      return NextResponse.json(
        { success: false, error: "valid_wallet_required" },
        { status: 400 },
      );
    }

    const result = await verifyTaskParticipant({
      taskId: id,
      walletAddress: normalizeWalletAddress(wallet),
    });

    if (result.error) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          eligible: false,
          participantStatus: result.participantStatus,
          checks: toPublicChecks(result.checks),
        },
        { status: result.status ?? 400 },
      );
    }

    return NextResponse.json({
      success: true,
      eligible: result.eligible,
      participantStatus: result.participantStatus,
      checks: toPublicChecks(result.checks),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "verify_failed";
    if (message === "task2earn_unavailable") {
      return NextResponse.json(
        { success: false, error: "unavailable" },
        { status: 503 },
      );
    }
    console.error("[api/tasks/id/verify] POST failed", error);
    return NextResponse.json(
      { success: false, error: "verify_failed" },
      { status: 500 },
    );
  }
}
