import { NextResponse } from "next/server";
import {
  buildJesseCatMintTransaction,
  isOpenSeaApiConfigured,
} from "@/lib/jessecat/buildMintTransaction";
import {
  JESSECAT_CONTRACT_ADDRESS,
  JESSECAT_OPENSEA_SLUG,
  JESSECAT_OPENSEA_URL,
} from "@/lib/jessecat/config";
import {
  isValidWalletAddress,
  normalizeWalletAddress,
} from "@/lib/x/config";

type MintBody = {
  minter?: string;
  quantity?: number;
};

/**
 * POST /api/jessecat/mint
 * Builds JesseCat Drop mint calldata via OpenSea (server-side API key).
 */
export async function POST(request: Request) {
  try {
    if (!isOpenSeaApiConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: "opensea_api_key_missing",
          message: "OPENSEA_API_KEY is not configured on the server.",
        },
        { status: 503 },
      );
    }

    let body: MintBody = {};
    try {
      body = (await request.json()) as MintBody;
    } catch {
      return NextResponse.json(
        { success: false, error: "invalid_json" },
        { status: 400 },
      );
    }

    const minter = body.minter;
    const quantity =
      typeof body.quantity === "number" ? body.quantity : Number(body.quantity);

    if (!minter || !isValidWalletAddress(minter)) {
      return NextResponse.json(
        { success: false, error: "valid_minter_required" },
        { status: 400 },
      );
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
      return NextResponse.json(
        {
          success: false,
          error: "invalid_quantity",
          message: "Quantity must be an integer between 1 and 100.",
        },
        { status: 400 },
      );
    }

    const mintTx = await buildJesseCatMintTransaction({
      minter: normalizeWalletAddress(minter),
      quantity,
    });

    return NextResponse.json({
      success: true,
      slug: JESSECAT_OPENSEA_SLUG,
      contractAddress: JESSECAT_CONTRACT_ADDRESS,
      collectionUrl: JESSECAT_OPENSEA_URL,
      quantity: mintTx.quantity,
      chain: mintTx.chain,
      to: mintTx.to,
      data: mintTx.data,
      value: mintTx.valueWei.toString(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to build JesseCat mint.";
    console.error("[api/jessecat/mint]", message);
    return NextResponse.json(
      {
        success: false,
        error: "opensea_mint_build_failed",
        message,
      },
      { status: 502 },
    );
  }
}
