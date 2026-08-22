import { NextResponse } from "next/server";
import {
  fetchJesseCatDropSummary,
  isOpenSeaApiConfigured,
} from "@/lib/jessecat/buildMintTransaction";
import {
  JESSECAT_CONTRACT_ADDRESS,
  JESSECAT_OPENSEA_SLUG,
  JESSECAT_OPENSEA_URL,
} from "@/lib/jessecat/config";

/**
 * GET /api/jessecat/drop
 * Drop metadata for UI (price / supply / limits). OpenSea is source of truth.
 */
export async function GET() {
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

    const drop = await fetchJesseCatDropSummary();

    return NextResponse.json({
      success: true,
      slug: JESSECAT_OPENSEA_SLUG,
      contractAddress: JESSECAT_CONTRACT_ADDRESS,
      collectionUrl: JESSECAT_OPENSEA_URL,
      drop,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load JesseCat drop.";
    console.error("[api/jessecat/drop]", message);
    return NextResponse.json(
      {
        success: false,
        error: "opensea_drop_fetch_failed",
        message,
      },
      { status: 502 },
    );
  }
}
