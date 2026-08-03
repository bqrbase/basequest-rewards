"use client";

import type { Address } from "viem";
import type { Config } from "wagmi";
import { signWalletMessage } from "@/lib/wallet/Signer";
import { WalletError } from "@/lib/wallet/Errors";
import { walletLogger } from "@/lib/wallet/logger";

export type EnsureAuthResult = { ok: true } | { ok: false; error: string };

/**
 * Client authentication orchestration (session check → challenge → sign → verify).
 * Server cookie/HMAC stays in lib/wallet/auth/*.
 */
export async function checkAuthSession(
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

export async function ensureAuthSession(params: {
  config: Config;
  address: Address;
}): Promise<EnsureAuthResult> {
  const { config, address } = params;

  try {
    if (await checkAuthSession(address)) {
      return { ok: true };
    }

    walletLogger.debug("auth-challenge", { address });

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

    const signature = await signWalletMessage({
      config,
      address,
      message: challengeJson.message,
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

    walletLogger.info("auth-ok", { address });
    return { ok: true };
  } catch (error) {
    if (error instanceof WalletError) {
      return { ok: false, error: error.message };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "wallet_auth_failed",
    };
  }
}

export async function requireAuthSession(params: {
  config: Config;
  address: Address;
}): Promise<void> {
  const result = await ensureAuthSession(params);
  if (!result.ok) {
    throw new WalletError(
      "AUTHENTICATION_FAILED",
      result.error === "wallet_not_connected"
        ? "Connect your wallet to continue."
        : "Sign the wallet ownership message to continue.",
    );
  }
}
