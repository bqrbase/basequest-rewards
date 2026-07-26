import { completeReferralForReferee } from "@/lib/referrals/server";
import {
  isValidWalletAddress,
  normalizeWalletAddress,
} from "@/lib/x/config";
import { NextResponse } from "next/server";

type CompleteBody = {
  wallet?: string;
};

/**
 * POST /api/referrals/complete
 * Awards the referrer once the referee completed the onboarding quest.
 */
export async function POST(request: Request) {
  try {
    let body: CompleteBody = {};
    try {
      body = (await request.json()) as CompleteBody;
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

    const result = await completeReferralForReferee(
      normalizeWalletAddress(body.wallet),
    );

    if (!result.ok) {
      return NextResponse.json(result, {
        status: result.error === "server_error" ? 500 : 400,
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[api/referrals/complete]", error);
    return NextResponse.json(
      { ok: false, error: "server_error" },
      { status: 500 },
    );
  }
}
