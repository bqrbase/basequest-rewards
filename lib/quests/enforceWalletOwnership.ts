/**
 * Shared ownership gate for API routes that award XP or write privileged rows.
 */
import { requireWalletOwnership } from "@/lib/wallet/auth/verifyOwnership";
import { NextResponse } from "next/server";

export async function enforceWalletOwnership(walletAddress: string) {
  const ownership = await requireWalletOwnership(walletAddress);
  if (ownership.ok) {
    return { ok: true as const, walletAddress: ownership.walletAddress };
  }

  return {
    ok: false as const,
    response: NextResponse.json(
      {
        success: false,
        error: ownership.error,
        message: ownership.message,
      },
      { status: 401 },
    ),
  };
}
