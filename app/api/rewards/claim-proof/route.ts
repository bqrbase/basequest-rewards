import {
  ClaimProofAlreadyClaimedError,
  ClaimProofNotFoundError,
  getClaimProof,
} from "@/lib/rewards/server/proofService";
import {
  isValidWalletAddress,
  normalizeWalletAddress,
} from "@/lib/x/config";
import { NextResponse } from "next/server";

/**
 * GET /api/rewards/claim-proof?wallet=0x...&campaignId=1&rewardId=0x...|actionKey
 * Returns Merkle proof args for RewardsDistributor.claim (no tx submitted).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get("wallet");
    const campaignIdRaw = searchParams.get("campaignId");
    const rewardId =
      searchParams.get("rewardId") || searchParams.get("actionKey");

    if (!wallet || !isValidWalletAddress(wallet)) {
      return NextResponse.json(
        { error: "valid_wallet_required" },
        { status: 400 },
      );
    }

    const onChainCampaignId = Number(campaignIdRaw);
    if (
      !campaignIdRaw ||
      !Number.isInteger(onChainCampaignId) ||
      onChainCampaignId < 1
    ) {
      return NextResponse.json(
        { error: "valid_campaign_id_required" },
        { status: 400 },
      );
    }

    if (!rewardId?.trim()) {
      return NextResponse.json(
        { error: "reward_id_or_action_key_required" },
        { status: 400 },
      );
    }

    const proof = await getClaimProof({
      walletAddress: normalizeWalletAddress(wallet),
      onChainCampaignId,
      rewardIdOrActionKey: rewardId,
    });

    return NextResponse.json({
      wallet: proof.wallet,
      campaignId: proof.onChainCampaignId,
      campaignUuid: proof.campaignUuid,
      actionKey: proof.actionKey,
      rewardId: proof.rewardId,
      amount: proof.amountWei,
      amountBqr: proof.amountBqr,
      merkleProof: proof.merkleProof,
      leafHash: proof.leafHash,
      leafIndex: proof.leafIndex,
      claimedOnChain: proof.claimedOnChain,
      // Ready for claimRewardsDistributor({ campaignId, rewardId, amount, merkleProof })
    });
  } catch (error) {
    if (error instanceof ClaimProofNotFoundError) {
      return NextResponse.json({ error: "proof_not_found" }, { status: 404 });
    }
    if (error instanceof ClaimProofAlreadyClaimedError) {
      return NextResponse.json({ error: "already_claimed" }, { status: 409 });
    }
    console.error("[api/rewards/claim-proof]", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
