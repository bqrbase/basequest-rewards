import {
  assertRewardsAdmin,
  RewardsAdminAuthError,
} from "@/lib/rewards/server/adminAuth";
import {
  CampaignRootMismatchError,
  linkCampaignOnChain,
} from "@/lib/rewards/server/campaignService";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/rewards/admin/campaigns/:id/link
 * Body: { onChainCampaignId: number } from CampaignCreated.
 * Verifies on-chain root == built root, then publishes.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    assertRewardsAdmin(request);
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      onChainCampaignId?: number;
    };

    if (
      body.onChainCampaignId === undefined ||
      !Number.isInteger(body.onChainCampaignId) ||
      body.onChainCampaignId < 1
    ) {
      return NextResponse.json(
        {
          error: "on_chain_campaign_id_required",
          message:
            "Pass the actual campaignId from CampaignCreated after createCampaign(builtRoot).",
        },
        { status: 400 },
      );
    }

    const campaign = await linkCampaignOnChain({
      campaignUuid: id,
      onChainCampaignId: body.onChainCampaignId,
    });

    return NextResponse.json({
      campaign,
      note:
        "Campaign published for claim-proof API. fund() remains an external owner action.",
    });
  } catch (error) {
    if (error instanceof RewardsAdminAuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    if (error instanceof CampaignRootMismatchError) {
      return NextResponse.json(
        {
          error: "root_mismatch",
          message: error.message,
          expectedRoot: error.computedRoot,
          onChainRoot: error.onChainRoot,
          onChainCampaignId: error.onChainCampaignId,
        },
        { status: 409 },
      );
    }
    console.error("[api/rewards/admin/campaigns/link]", error);
    const message = error instanceof Error ? error.message : "server_error";
    const status =
      message.includes("not found") || message.includes("must be ready")
        ? 404
        : message.includes("does not exist")
          ? 404
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
