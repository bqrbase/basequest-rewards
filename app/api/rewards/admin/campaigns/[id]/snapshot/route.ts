import {
  assertRewardsAdmin,
  RewardsAdminAuthError,
} from "@/lib/rewards/server/adminAuth";
import { snapshotCampaignEligibility } from "@/lib/rewards/server/campaignService";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/rewards/admin/campaigns/:id/snapshot
 * Eligibility allocations only — no Merkle leaves, no campaignId assumption.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    assertRewardsAdmin(request);
    const { id } = await context.params;
    const result = await snapshotCampaignEligibility({ campaignUuid: id });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof RewardsAdminAuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    console.error("[api/rewards/admin/campaigns/snapshot]", error);
    const message = error instanceof Error ? error.message : "server_error";
    const status = message.includes("No eligible")
      ? 422
      : message.includes("not found")
        ? 404
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
