import { confirmSharePoolClaim } from "@/lib/task2earn/share-pool-confirm";
import { getShareRewardsCampaign } from "@/lib/task2earn/share-reward";
import {
  isValidWalletAddress,
  normalizeWalletAddress,
} from "@/lib/x/config";
import { NextResponse } from "next/server";

/**
 * POST /api/tasks/share-rewards/claim
 * Marks a verified share as paid only after the on-chain claim receipt succeeds.
 */
export async function POST(request: Request) {
  try {
    let body: unknown = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const record =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};
    const walletRaw =
      typeof record.wallet === "string"
        ? record.wallet
        : typeof record.walletAddress === "string"
          ? record.walletAddress
          : "";
    const txHash = typeof record.txHash === "string" ? record.txHash.trim() : "";
    if (!walletRaw || !isValidWalletAddress(walletRaw)) {
      return NextResponse.json(
        { success: false, error: "valid_wallet_required" },
        { status: 400 },
      );
    }
    if (!txHash) {
      return NextResponse.json(
        { success: false, error: "invalid_tx_hash" },
        { status: 400 },
      );
    }

    const wallet = normalizeWalletAddress(walletRaw);
    const result = await confirmSharePoolClaim({
      walletAddress: wallet,
      txHash,
    });
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status },
      );
    }

    const campaign = await getShareRewardsCampaign(wallet);
    return NextResponse.json({
      success: true,
      alreadyPaid: result.alreadyPaid,
      txHash: result.txHash,
      amountBqr: result.amountBqr,
      campaign,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "share_claim_failed";
    if (message === "task2earn_unavailable") {
      return NextResponse.json(
        { success: false, error: "unavailable" },
        { status: 503 },
      );
    }
    console.error("[api/tasks/share-rewards/claim] POST failed", error);
    return NextResponse.json(
      { success: false, error: "share_claim_failed" },
      { status: 500 },
    );
  }
}
