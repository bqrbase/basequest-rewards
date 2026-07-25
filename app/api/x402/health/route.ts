import { createFacilitatorConfig } from "@coinbase/x402";
import { NextResponse } from "next/server";

/**
 * GET /api/x402/health
 * Phase 1 — CDP + x402 readiness check (no payment).
 */
export async function GET() {
  try {
    const facilitator = createFacilitatorConfig(
      process.env.CDP_API_KEY_ID,
      process.env.CDP_API_KEY_SECRET,
    );

    if (!facilitator?.url) {
      throw new Error("CDP facilitator config missing url");
    }

    await Promise.all([
      import("@x402/core/server"),
      import("@x402/evm/exact/server"),
      import("@x402/next"),
    ]);

    return NextResponse.json({
      status: "ok",
      cdp: "connected",
      x402: "ready",
      network: "base",
    });
  } catch (error) {
    console.error("[api/x402/health]", error);
    return NextResponse.json(
      {
        status: "error",
        cdp: "disconnected",
        x402: "not_ready",
        network: "base",
      },
      { status: 503 },
    );
  }
}
