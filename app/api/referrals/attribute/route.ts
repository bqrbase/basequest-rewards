import { attributeReferral } from "@/lib/referrals/server";
import {
  isValidWalletAddress,
  normalizeWalletAddress,
} from "@/lib/x/config";
import { NextResponse } from "next/server";

type AttributeBody = {
  wallet?: string;
  code?: string;
};

/**
 * POST /api/referrals/attribute
 * Creates a pending referral after the referee connects a wallet.
 */
export async function POST(request: Request) {
  try {
    let body: AttributeBody = {};
    try {
      body = (await request.json()) as AttributeBody;
    } catch {
      return NextResponse.json(
        { ok: false, error: "invalid_json" },
        { status: 400 },
      );
    }

    if (!body.wallet || !isValidWalletAddress(body.wallet)) {
      return NextResponse.json(
        { ok: false, error: "valid_wallet_required" },
        { status: 400 },
      );
    }

    if (!body.code || typeof body.code !== "string") {
      return NextResponse.json(
        { ok: false, error: "code_required" },
        { status: 400 },
      );
    }

    const result = await attributeReferral({
      refereeWallet: normalizeWalletAddress(body.wallet),
      code: body.code,
    });

    if (!result.ok) {
      const status =
        result.error === "server_error"
          ? 500
          : result.error === "code_not_found"
            ? 404
            : 400;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[api/referrals/attribute]", error);
    return NextResponse.json(
      { ok: false, error: "server_error" },
      { status: 500 },
    );
  }
}
