import { NextResponse } from "next/server";
import {
  awardOneTimeQuest,
  progressResponse,
} from "@/lib/quests/awardOneTimeQuest";
import { LIFI_BASE_CHAIN_ID } from "@/lib/swap/lifi";
import { verifyBaseDestinationTx } from "@/lib/swap/verifyBaseDestinationTx";
import { extractSupabaseError } from "@/lib/supabase/deployedContracts";
import {
  isValidWalletAddress,
  normalizeWalletAddress,
} from "@/lib/x/config";

type CompleteBody = {
  wallet?: string;
  bridgeStatus?: string;
  destinationTxHash?: string;
  destinationChainId?: number;
  sourceTxHash?: string;
};

/**
 * POST /api/quests/bridge-to-base/complete
 * Awards +30 XP only when bridgeStatus === "completed" and Base dest tx is confirmed.
 */
export async function POST(request: Request) {
  try {
    let body: CompleteBody = {};
    try {
      body = (await request.json()) as CompleteBody;
    } catch {
      return NextResponse.json(
        { success: false, error: "invalid_json" },
        { status: 400 },
      );
    }

    const wallet = body.wallet;
    const bridgeStatus = body.bridgeStatus;
    const destinationTxHash = body.destinationTxHash;
    const destinationChainId = body.destinationChainId;

    if (!wallet || !isValidWalletAddress(wallet)) {
      return NextResponse.json(
        { success: false, error: "valid_wallet_required" },
        { status: 400 },
      );
    }

    // Never award while pending / bridging / waiting_destination.
    if (bridgeStatus !== "completed") {
      return NextResponse.json(
        {
          success: false,
          error: "bridge_not_completed",
          message:
            "Quest requires bridgeStatus === \"completed\" after destination settlement.",
        },
        { status: 400 },
      );
    }

    if (!destinationTxHash || typeof destinationTxHash !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "destination_tx_hash_required",
          message: "destinationTxHash is required.",
        },
        { status: 400 },
      );
    }

    if (destinationChainId !== LIFI_BASE_CHAIN_ID) {
      return NextResponse.json(
        {
          success: false,
          error: "invalid_destination_chain",
          message: "destinationChainId must be Base (8453).",
        },
        { status: 400 },
      );
    }

    const verification = await verifyBaseDestinationTx({
      txHash: destinationTxHash,
    });

    if (!verification.ok) {
      return NextResponse.json(
        {
          success: false,
          error: verification.error,
          message: verification.message,
        },
        { status: 400 },
      );
    }

    const walletAddress = normalizeWalletAddress(wallet);
    const { progress, alreadyCompleted } = await awardOneTimeQuest({
      walletAddress,
      questId: "bridge-to-base",
    });

    return NextResponse.json({
      success: true,
      alreadyCompleted,
      destinationTxHash: verification.txHash.toLowerCase(),
      destinationChainId: verification.chainId,
      sourceTxHash: body.sourceTxHash?.toLowerCase() ?? null,
      progress: progressResponse(progress),
    });
  } catch (error) {
    const info = extractSupabaseError(error);
    console.error("[bridge-to-base/complete]", {
      code: info.code,
      message: info.message,
      details: info.details,
      hint: info.hint,
      raw: info.raw,
    });
    return NextResponse.json(
      {
        success: false,
        error: info.message,
      },
      { status: 500 },
    );
  }
}
