"use client";

import {
  checkWalletAuthSession,
  ensureWalletAuthSession,
  type EnsureWalletAuthResult,
} from "@/lib/wallet/auth/ensureSessionClient";
import { useCallback, useRef } from "react";
import { useAccount, useConfig } from "wagmi";

/**
 * Lazy wallet ownership session helper.
 * Does not run on connect — call only before protected server actions.
 * Signs once when needed; reuses an existing valid session.
 */
export function useWalletAuth() {
  const { address, status } = useAccount();
  const config = useConfig();
  const inFlight = useRef<Promise<EnsureWalletAuthResult> | null>(null);

  const ensureWalletAuth =
    useCallback(async (): Promise<EnsureWalletAuthResult> => {
      if (status !== "connected" || !address) {
        return { ok: false, error: "wallet_not_connected" };
      }

      if (inFlight.current) {
        return inFlight.current;
      }

      const run = ensureWalletAuthSession({ config, address }).finally(() => {
        inFlight.current = null;
      });

      inFlight.current = run;
      return run;
    }, [address, config, status]);

  const hasWalletAuthSession = useCallback(async (): Promise<boolean> => {
    if (status !== "connected" || !address) {
      return false;
    }
    return checkWalletAuthSession(address);
  }, [address, status]);

  return { ensureWalletAuth, hasWalletAuthSession };
}
