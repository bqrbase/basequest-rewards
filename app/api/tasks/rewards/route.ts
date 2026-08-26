import { listWalletShareRewards } from "@/lib/task2earn/share-reward";
import { T2E_EARNED_BQR_LABEL } from "@/lib/task2earn/constants";
import {
  isValidWalletAddress,
  normalizeWalletAddress,
} from "@/lib/x/config";
import { NextResponse } from "next/server";

/**
 * GET /api/tasks/rewards?wallet=0x...
 * Task2Earn off-chain earned BQR from t2e_reward_ledger only.
 * Not on-chain BQR and not RewardsDistributor.
 */
export async function GET(request: Request) {
  try {
    const wallet = new URL(request.url).searchParams.get("wallet");
    if (!wallet || !isValidWalletAddress(wallet)) {
      return NextResponse.json(
        { success: false, error: "valid_wallet_required" },
        { status: 400 },
      );
    }

    const result = await listWalletShareRewards(normalizeWalletAddress(wallet));
    return NextResponse.json({
      success: true,
      label: result.label,
      earnedBqr: result.earnedBqr,
      entries: result.entries,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "rewards_failed";
    if (message === "task2earn_unavailable") {
      return NextResponse.json(
        { success: false, error: "unavailable", label: T2E_EARNED_BQR_LABEL },
        { status: 503 },
      );
    }
    console.error("[api/tasks/rewards] GET failed", error);
    return NextResponse.json(
      { success: false, error: "rewards_failed" },
      { status: 500 },
    );
  }
}
