"use client";

import { useCallback, useRef } from "react";
import { useAccount, useConfig } from "wagmi";
import { signMessage } from "wagmi/actions";

type EnsureWalletAuthResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Ensures a verified wallet ownership session cookie exists.
 * Signs once when needed; reuses an existing valid session.
 */
export function useWalletAuth() {
  const { address, status } = useAccount();
  const config = useConfig();
  const inFlight = useRef<Promise<EnsureWalletAuthResult> | null>(null);

  const ensureWalletAuth = useCallback(async (): Promise<EnsureWalletAuthResult> => {
    if (status !== "connected" || !address) {
      return { ok: false, error: "wallet_not_connected" };
    }

    if (inFlight.current) {
      return inFlight.current;
    }

    const run = (async (): Promise<EnsureWalletAuthResult> => {
      try {
        const sessionResponse = await fetch(
          `/api/auth/wallet/session?wallet=${encodeURIComponent(address)}`,
          { credentials: "include" },
        );
        const sessionJson = (await sessionResponse.json()) as {
          success?: boolean;
          authenticated?: boolean;
        };

        if (sessionResponse.ok && sessionJson.success && sessionJson.authenticated) {
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
              verifyJson.message ||
              verifyJson.error ||
              "wallet_verify_failed",
          };
        }

        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : "wallet_auth_failed",
        };
      } finally {
        inFlight.current = null;
      }
    })();

    inFlight.current = run;
    return run;
  }, [address, config, status]);

  return { ensureWalletAuth };
}
