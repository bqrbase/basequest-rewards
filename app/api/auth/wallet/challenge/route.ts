import { NextResponse } from "next/server";
import { buildWalletAuthMessage } from "@/lib/wallet/auth/message";
import {
  createChallengeNonce,
  setWalletAuthChallengeCookie,
} from "@/lib/wallet/auth/session";
import {
  isValidWalletAddress,
  normalizeWalletAddress,
} from "@/lib/x/config";

type ChallengeBody = {
  wallet?: string;
};

/**
 * POST /api/auth/wallet/challenge
 * Issues a personal_sign challenge for wallet ownership verification.
 */
export async function POST(request: Request) {
  try {
    let body: ChallengeBody = {};
    try {
      body = (await request.json()) as ChallengeBody;
    } catch {
      return NextResponse.json(
        { success: false, error: "invalid_json" },
        { status: 400 },
      );
    }

    const wallet = body.wallet;
    if (!wallet || !isValidWalletAddress(wallet)) {
      return NextResponse.json(
        { success: false, error: "valid_wallet_required" },
        { status: 400 },
      );
    }

    const walletAddress = normalizeWalletAddress(wallet);
    const nonce = createChallengeNonce();
    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const message = buildWalletAuthMessage({
      walletAddress,
      nonce,
      issuedAt,
      expiresAt,
    });

    await setWalletAuthChallengeCookie({
      walletAddress,
      nonce,
      issuedAt,
      expiresAt,
      message,
    });

    return NextResponse.json({
      success: true,
      wallet: walletAddress,
      nonce,
      issuedAt,
      expiresAt,
      message,
    });
  } catch (error) {
    console.error("[auth/wallet/challenge]", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "wallet_challenge_failed",
      },
      { status: 500 },
    );
  }
}
