"use client";

import { BASEQUEST_GENESIS_ADDRESS } from "@/lib/contracts/abi/BaseQuestGenesis";
import { WALLET_AUTH_PUBLIC_COOKIE } from "@/lib/wallet/auth/constants";
import type { QueryClient } from "@tanstack/react-query";

/**
 * Clear the non-httpOnly public auth cookie from the browser.
 * httpOnly session/challenge cookies are cleared by POST /api/auth/wallet/logout.
 */
export function clearWalletAuthPublicCookieClient() {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${WALLET_AUTH_PUBLIC_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
}

/** Drop cached Genesis holder reads so access resets after disconnect. */
export function resetGenesisAccessQueries(queryClient: QueryClient) {
  const genesisAddress = BASEQUEST_GENESIS_ADDRESS.toLowerCase();

  queryClient.removeQueries({
    predicate: (query) => {
      try {
        return JSON.stringify(query.queryKey).toLowerCase().includes(genesisAddress);
      } catch {
        return false;
      }
    },
  });
}

/**
 * End the wallet ownership session and clear client-side auth/Genesis cache.
 * Safe to call multiple times (e.g. disconnect UI + lifecycle safety net).
 */
export async function clearWalletAuthClientSession(
  queryClient?: QueryClient,
): Promise<void> {
  try {
    await fetch("/api/auth/wallet/logout", {
      method: "POST",
      credentials: "include",
    });
  } catch (error) {
    console.warn("[clearWalletAuthClientSession] logout request failed", error);
  }

  clearWalletAuthPublicCookieClient();

  if (queryClient) {
    resetGenesisAccessQueries(queryClient);
  }
}
