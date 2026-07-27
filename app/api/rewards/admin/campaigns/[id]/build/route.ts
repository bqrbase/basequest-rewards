import {
  assertRewardsAdmin,
  RewardsAdminAuthError,
} from "@/lib/rewards/server/adminAuth";
import { buildCampaignMerkle } from "@/lib/rewards/server/campaignService";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/rewards/admin/campaigns/:id/build
 * Materialize Merkle root + proofs from the snapshot.
 * Leaf = keccak256(account, rewardId, amount) — no campaignId, no prediction.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    assertRewardsAdmin(request);
    const { id } = await context.params;
    // Body optional / ignored — kept for API compatibility.
    await request.json().catch(() => ({}));

    const result = await buildCampaignMerkle({ campaignUuid: id });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof RewardsAdminAuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    console.error("[api/rewards/admin/campaigns/build]", error);
    const message = error instanceof Error ? error.message : "server_error";
    const status = message.includes("No snapshotted") || message.includes("not found")
      ? 404
      : message.includes("No eligible")
        ? 422
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
