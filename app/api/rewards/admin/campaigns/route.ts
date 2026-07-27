import {
  assertRewardsAdmin,
  RewardsAdminAuthError,
} from "@/lib/rewards/server/adminAuth";
import {
  createDraftCampaign,
  listCampaigns,
} from "@/lib/rewards/server/campaignService";
import { NextResponse } from "next/server";

/**
 * GET  /api/rewards/admin/campaigns — list campaign metadata
 * POST /api/rewards/admin/campaigns — create draft campaign
 *
 * Auth: Authorization: Bearer <REWARDS_ADMIN_SECRET>
 *       or x-rewards-admin-secret: <REWARDS_ADMIN_SECRET>
 */
export async function GET(request: Request) {
  try {
    assertRewardsAdmin(request);
    const campaigns = await listCampaigns();
    return NextResponse.json({ campaigns });
  } catch (error) {
    return adminErrorResponse(error, "api/rewards/admin/campaigns GET");
  }
}

export async function POST(request: Request) {
  try {
    assertRewardsAdmin(request);
    const body = (await request.json()) as {
      name?: string;
      description?: string;
      campaignType?: number;
      startTime?: number;
      endTime?: number;
    };

    if (!body.name?.trim()) {
      return NextResponse.json({ error: "name_required" }, { status: 400 });
    }

    const campaign = await createDraftCampaign({
      name: body.name,
      description: body.description,
      campaignType: body.campaignType,
      startTime: body.startTime,
      endTime: body.endTime,
    });

    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    return adminErrorResponse(error, "api/rewards/admin/campaigns POST");
  }
}

function adminErrorResponse(error: unknown, label: string) {
  if (error instanceof RewardsAdminAuthError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  }
  console.error(`[${label}]`, error);
  const message = error instanceof Error ? error.message : "server_error";
  return NextResponse.json({ error: message }, { status: 500 });
}
