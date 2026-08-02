"use client";

import { signMessage } from "wagmi/actions";
import type { Config } from "wagmi";
import type { Address } from "viem";

export type EnsureWalletAuthResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Read-only session check — never prompts for a signature.
 */
export async function checkWalletAuthSession(
  walletAddress: Address,
): Promise<boolean> {
  try {
    const sessionResponse = await fetch(
      `/api/auth/wallet/session?wallet=${encodeURIComponent(walletAddress)}`,
      { credentials: "include" },
    );
    const sessionJson = (await sessionResponse.json()) as {
      success?: boolean;
      authenticated?: boolean;
    };
    return Boolean(
      sessionResponse.ok && sessionJson.success && sessionJson.authenticated,
    );
  } catch {
    return false;
  }
}

/**
 * Ensures a verified wallet ownership session cookie exists.
 * Reuses a valid session; only challenges + signs when needed.
 */
export async function ensureWalletAuthSession(params: {
  config: Config;
  address: Address;
}): Promise<EnsureWalletAuthResult> {
  const { config, address } = params;

  try {
    if (await checkWalletAuthSession(address)) {
      return { ok: true };
    }

    const challengeResponse = await fetch("/api/auth/wallet/challenge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ wallet: address }),
    });
    const challengeJson = (await challengeResponse.json()) as {
      success?: boolean;
      message?: string;
      error?: string;
    };

    if (
      !challengeResponse.ok ||
      !challengeJson.success ||
      !challengeJson.message
    ) {
      return {
        ok: false,
        error: challengeJson.error || "wallet_challenge_failed",
      };
    }

    const signature = await signMessage(config, {
      message: challengeJson.message,
      account: address,
    });

    const verifyResponse = await fetch("/api/auth/wallet/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        wallet: address,
        signature,
        message: challengeJson.message,
      }),
    });
    const verifyJson = (await verifyResponse.json()) as {
      success?: boolean;
      error?: string;
      message?: string;
    };

    if (!verifyResponse.ok || !verifyJson.success) {
      return {
        ok: false,
        error:
          verifyJson.message || verifyJson.error || "wallet_verify_failed",
      };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "wallet_auth_failed",
    };
  }
}
