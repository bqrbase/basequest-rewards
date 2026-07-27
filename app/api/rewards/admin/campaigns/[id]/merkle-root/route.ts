import {
  assertRewardsAdmin,
  RewardsAdminAuthError,
} from "@/lib/rewards/server/adminAuth";
import { computeMerkleRootForSnapshot } from "@/lib/rewards/server/campaignService";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/rewards/admin/campaigns/:id/merkle-root
 * Compute Merkle root for snapshotted allocations (no campaignId in leaf).
 * Does not persist proofs. Prefer POST .../build for the publish path.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    assertRewardsAdmin(request);
    const { id } = await context.params;
    await request.json().catch(() => ({}));

    const result = await computeMerkleRootForSnapshot({ campaignUuid: id });

    return NextResponse.json({
      ...result,
      note:
        "Use merkleRoot as createCampaign's root after POST .../build (recommended), " +
        "then POST .../link with the CampaignCreated campaignId.",
    });
  } catch (error) {
    if (error instanceof RewardsAdminAuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    console.error("[api/rewards/admin/campaigns/merkle-root]", error);
    const message = error instanceof Error ? error.message : "server_error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
