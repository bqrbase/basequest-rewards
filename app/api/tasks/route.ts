import {
  createDraftTask,
  listJoinedTasks,
  listMarketplaceTasks,
} from "@/lib/task2earn/server";
import {
  isValidWalletAddress,
  normalizeWalletAddress,
} from "@/lib/x/config";
import { NextResponse } from "next/server";

/**
 * GET /api/tasks
 * Public marketplace list by default. Pass scope=joined&wallet= to list
 * campaigns this wallet has joined (including ended), not Share Rewards.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const scope = url.searchParams.get("scope");
    if (scope === "joined") {
      const rawWallet = url.searchParams.get("wallet");
      if (!rawWallet || !isValidWalletAddress(rawWallet)) {
        return NextResponse.json(
          { success: false, error: "valid_wallet_required" },
          { status: 400 },
        );
      }
      const tasks = await listJoinedTasks(normalizeWalletAddress(rawWallet));
      return NextResponse.json({ success: true, tasks });
    }

    const tasks = await listMarketplaceTasks();
    return NextResponse.json({ success: true, tasks });
  } catch (error) {
    const message = error instanceof Error ? error.message : "tasks_list_failed";
    if (message === "task2earn_unavailable") {
      return NextResponse.json(
        { success: true, tasks: [], error: "unavailable" },
        { status: 200 },
      );
    }
    console.error("[api/tasks] GET failed", error);
    return NextResponse.json(
      { success: false, error: "tasks_list_failed" },
      { status: 500 },
    );
  }
}

type CreateBody = {
  wallet?: string;
  fid?: unknown;
  [key: string]: unknown;
};

/**
 * POST /api/tasks
 * Creates an off-chain task draft. No tokens are transferred.
 *
 * Auth follows the existing wallet-in-body pattern (same as /api/progress/sync
 * and POST /api/tasks/:id/join). This app does not have a cryptographic wallet
 * session, so the endpoint must not be used for production funding.
 * Client FID, verification results, and client-calculated fees/USD are ignored.
 */
export async function POST(request: Request) {
  try {
    let body: CreateBody = {};
    try {
      body = (await request.json()) as CreateBody;
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

    const result = await createDraftTask({
      walletAddress: normalizeWalletAddress(wallet),
      body,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          errors: result.errors,
          minPoolUsd: result.minPoolUsd,
        },
        { status: result.status },
      );
    }

    return NextResponse.json({
      success: true,
      task: result.task,
      usdEstimateUnavailable: result.usdEstimateUnavailable,
      funded: false,
      notice:
        "This creates an off-chain task draft. No tokens will be transferred.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "task_create_failed";
    if (message === "task2earn_unavailable") {
      return NextResponse.json(
        { success: false, error: "unavailable" },
        { status: 503 },
      );
    }
    console.error("[api/tasks] POST failed", error);
    return NextResponse.json(
      { success: false, error: "task_create_failed" },
      { status: 500 },
    );
  }
}
