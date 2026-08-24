import { fetchTokenUsdPrices } from "@/lib/task2earn/prices";
import { NextResponse } from "next/server";

/**
 * GET /api/tasks/prices
 * Blockscout-backed USD quotes only. BQR is always unavailable.
 */
export async function GET() {
  try {
    const prices = await fetchTokenUsdPrices();
    return NextResponse.json({ success: true, prices });
  } catch (error) {
    console.error("[api/tasks/prices] GET failed", error);
    return NextResponse.json({
      success: true,
      prices: { BQR: null, USDC: null, ETH: null },
    });
  }
}
