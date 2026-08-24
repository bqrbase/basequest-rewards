import { getMarketplaceTask } from "@/lib/task2earn/server";
import {
  isValidWalletAddress,
  normalizeWalletAddress,
} from "@/lib/x/config";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/tasks/:id
 * Wallet query is optional and used only to show join state.
 * FID is never accepted from the client.
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: "task_id_required" },
        { status: 400 },
      );
    }

    const url = new URL(request.url);
    const rawWallet = url.searchParams.get("wallet");
    const viewerWallet =
      rawWallet && isValidWalletAddress(rawWallet)
        ? normalizeWalletAddress(rawWallet)
        : undefined;

    const task = await getMarketplaceTask(id, viewerWallet);
    if (!task) {
      return NextResponse.json(
        { success: false, error: "task_not_found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, task });
  } catch (error) {
    const message = error instanceof Error ? error.message : "task_get_failed";
    if (message === "task2earn_unavailable") {
      return NextResponse.json(
        { success: false, error: "unavailable" },
        { status: 503 },
      );
    }
    console.error("[api/tasks/id] GET failed", error);
    return NextResponse.json(
      { success: false, error: "task_get_failed" },
      { status: 500 },
    );
  }
}
