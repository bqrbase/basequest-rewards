import {
  clearWalletAuthChallengeCookie,
  readWalletAuthChallengeCookie,
  readWalletAuthSessionCookie,
} from "@/lib/wallet/auth/session";
import { normalizeWalletAddress } from "@/lib/x/config";
import { verifyMessage } from "viem";

export type WalletOwnershipResult =
  | { ok: true; walletAddress: string }
  | {
      ok: false;
      error:
        | "wallet_auth_required"
        | "wallet_mismatch"
        | "challenge_missing"
        | "challenge_mismatch"
        | "invalid_signature";
      message: string;
    };

/**
 * Require a verified wallet ownership session for `walletAddress`.
 * Call from API routes before awarding XP or writing privileged rows.
 */
export async function requireWalletOwnership(
  walletAddress: string,
): Promise<WalletOwnershipResult> {
  const normalized = normalizeWalletAddress(walletAddress);
  const session = await readWalletAuthSessionCookie();

  if (!session) {
    return {
      ok: false,
      error: "wallet_auth_required",
      message: "Prove wallet ownership before continuing.",
    };
  }

  if (session.walletAddress !== normalized) {
    return {
      ok: false,
      error: "wallet_mismatch",
      message: "Authenticated wallet does not match the request wallet.",
    };
  }

  return { ok: true, walletAddress: normalized };
}

/**
 * Verify a personal_sign response against the pending challenge cookie.
 */
export async function verifyWalletOwnershipSignature(params: {
  walletAddress: string;
  signature: string;
  message?: string;
}): Promise<WalletOwnershipResult> {
  const normalized = normalizeWalletAddress(params.walletAddress);
  const challenge = await readWalletAuthChallengeCookie();

  if (!challenge) {
    return {
      ok: false,
      error: "challenge_missing",
      message: "No wallet auth challenge found. Request a new challenge.",
    };
  }

  if (normalizeWalletAddress(challenge.walletAddress) !== normalized) {
    return {
      ok: false,
      error: "challenge_mismatch",
      message: "Challenge wallet does not match.",
    };
  }

  if (new Date(challenge.expiresAt).getTime() < Date.now()) {
    await clearWalletAuthChallengeCookie();
    return {
      ok: false,
      error: "challenge_mismatch",
      message: "Wallet auth challenge expired. Request a new challenge.",
    };
  }

  const message = params.message ?? challenge.message;
  if (message !== challenge.message) {
    return {
      ok: false,
      error: "challenge_mismatch",
      message: "Signed message does not match the challenge.",
    };
  }

  let valid = false;
  try {
    valid = await verifyMessage({
      address: normalized as `0x${string}`,
      message,
      signature: params.signature as `0x${string}`,
    });
  } catch {
    valid = false;
  }

  if (!valid) {
    return {
      ok: false,
      error: "invalid_signature",
      message: "Wallet signature verification failed.",
    };
  }

  await clearWalletAuthChallengeCookie();
  return { ok: true, walletAddress: normalized };
}
