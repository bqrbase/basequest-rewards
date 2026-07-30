import { NextResponse } from "next/server";
import { setWalletAuthSessionCookie } from "@/lib/wallet/auth/session";
import { verifyWalletOwnershipSignature } from "@/lib/wallet/auth/verifyOwnership";
import {
  isValidWalletAddress,
  normalizeWalletAddress,
} from "@/lib/x/config";

type VerifyBody = {
  wallet?: string;
  signature?: string;
  message?: string;
};

const SESSION_TTL_MS = 60 * 60 * 24 * 1000;

/**
 * POST /api/auth/wallet/verify
 * Verifies personal_sign and sets an httpOnly ownership session cookie.
 */
export async function POST(request: Request) {
  try {
    let body: VerifyBody = {};
    try {
      body = (await request.json()) as VerifyBody;
    } catch {
      return NextResponse.json(
        { success: false, error: "invalid_json" },
        { status: 400 },
      );
    }

    const wallet = body.wallet;
    const signature = body.signature;

    if (!wallet || !isValidWalletAddress(wallet)) {
      return NextResponse.json(
        { success: false, error: "valid_wallet_required" },
        { status: 400 },
      );
    }

    if (!signature || typeof signature !== "string") {
      return NextResponse.json(
        { success: false, error: "signature_required" },
        { status: 400 },
      );
    }

    const walletAddress = normalizeWalletAddress(wallet);
    const verified = await verifyWalletOwnershipSignature({
      walletAddress,
      signature,
      message: body.message,
    });

    if (!verified.ok) {
      return NextResponse.json(
        {
          success: false,
          error: verified.error,
          message: verified.message,
        },
        { status: 401 },
      );
    }

    const expiresAt = Date.now() + SESSION_TTL_MS;
    await setWalletAuthSessionCookie({
      walletAddress: verified.walletAddress,
      expiresAt,
    });

    return NextResponse.json({
      success: true,
      wallet: verified.walletAddress,
      expiresAt,
    });
  } catch (error) {
    console.error("[auth/wallet/verify]", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "wallet_verify_failed",
      },
      { status: 500 },
    );
  }
}
