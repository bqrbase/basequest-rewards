import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import {
  getX402PayToAddress,
  X402_DEMO_PRICE,
  X402_NETWORK,
} from "@/lib/x402/config";
import { getX402ResourceServer } from "@/lib/x402/server";

/**
 * x402 demo endpoint (Base Mainnet).
 * Requires one successful exact USDC payment via x402 v2.
 */
async function handler(_request: NextRequest) {
  return NextResponse.json(
    {
      ok: true,
      message: "x402 payment successful",
      quest: "x402-payment",
      network: X402_NETWORK,
    },
    { status: 200 },
  );
}

const payTo = getX402PayToAddress();

export const GET = payTo
  ? withX402(
      handler,
      {
        accepts: {
          scheme: "exact",
          price: X402_DEMO_PRICE,
          network: X402_NETWORK,
          payTo,
        },
        description: "BaseQuest Rewards x402 payment demo",
        mimeType: "application/json",
      },
      getX402ResourceServer(),
    )
  : async function misconfigured() {
      return NextResponse.json(
        {
          ok: false,
          error:
            "x402 demo is not configured. Set X402_PAY_TO (receiver address) and CDP facilitator credentials.",
        },
        { status: 503 },
      );
    };
