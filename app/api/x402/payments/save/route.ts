import { NextResponse } from "next/server";
import { enforceWalletOwnership } from "@/lib/quests/enforceWalletOwnership";
import {
  extractSupabaseError,
  saveX402Payment,
} from "@/lib/supabase/x402Payments";
import {
  isValidWalletAddress,
  normalizeWalletAddress,
} from "@/lib/x/config";
import { X402_NETWORK, X402_PRICE } from "@/lib/x402/config";

type SaveBody = {
  wallet?: string;
  txHash?: string;
  amount?: string;
  network?: string;
};

function isTxHash(value: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(value);
}

/**
 * POST /api/x402/payments/save
 * Persists a settled x402 payment (service role).
 */
export async function POST(request: Request) {
  try {
    let body: SaveBody = {};
    try {
      body = (await request.json()) as SaveBody;
    } catch {
      return NextResponse.json(
        { success: false, error: "invalid_json" },
        { status: 400 },
      );
    }

    const wallet = body.wallet;
    const txHash = body.txHash;
    const amount =
      typeof body.amount === "string" && body.amount.trim().length > 0
        ? body.amount.trim()
        : X402_PRICE;
    const network = body.network?.trim() || X402_NETWORK;

    if (!wallet || !isValidWalletAddress(wallet)) {
      return NextResponse.json(
        { success: false, error: "valid_wallet_required" },
        { status: 400 },
      );
    }

    if (!txHash || !isTxHash(txHash)) {
      return NextResponse.json(
        { success: false, error: "valid_tx_hash_required" },
        { status: 400 },
      );
    }

    const walletAddress = normalizeWalletAddress(wallet);
    const ownership = await enforceWalletOwnership(walletAddress);
    if (!ownership.ok) {
      return ownership.response;
    }

    const row = await saveX402Payment({
      walletAddress,
      txHash,
      amount,
      network,
    });

    return NextResponse.json({
      success: true,
      payment: row,
    });
  } catch (error) {
    const info = extractSupabaseError(error);
    console.error("[api/x402/payments/save] failed:", {
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
        supabase: {
          code: info.code ?? null,
          message: info.message,
          details: info.details ?? null,
          hint: info.hint ?? null,
        },
      },
      { status: 500 },
    );
  }
}
