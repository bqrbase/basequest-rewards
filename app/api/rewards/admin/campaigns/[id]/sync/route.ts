import {
  assertRewardsAdmin,
  RewardsAdminAuthError,
} from "@/lib/rewards/server/adminAuth";
import { syncCampaignClaims } from "@/lib/rewards/server/claimSync";
import { closeCampaign } from "@/lib/rewards/server/campaignService";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/rewards/admin/campaigns/:id/sync
 * Refresh claimed_on_chain from RewardsDistributor.isClaimed (read-only).
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    assertRewardsAdmin(request);
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      action?: "sync" | "close";
    };

    if (body.action === "close") {
      const campaign = await closeCampaign(id);
      return NextResponse.json({ campaign });
    }

    const result = await syncCampaignClaims(id);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof RewardsAdminAuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    console.error("[api/rewards/admin/campaigns/sync]", error);
    const message = error instanceof Error ? error.message : "server_error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
