"use client";

import type { Config } from "wagmi";
import type { Address } from "viem";
import {
  checkAuthSession,
  ensureAuthSession,
  type EnsureAuthResult,
} from "@/lib/wallet/Authentication";

export type EnsureWalletAuthResult = EnsureAuthResult;

/**
 * Read-only session check — never prompts for a signature.
 * Phase 1 façade over Authentication.checkAuthSession.
 */
export async function checkWalletAuthSession(
  walletAddress: Address,
): Promise<boolean> {
  return checkAuthSession(walletAddress);
}

/**
 * Ensures a verified wallet ownership session cookie exists.
 * Phase 1 façade over Authentication.ensureAuthSession.
 * HTTP contract (/api/auth/wallet/*) unchanged.
 */
export async function ensureWalletAuthSession(params: {
  config: Config;
  address: Address;
}): Promise<EnsureWalletAuthResult> {
  return ensureAuthSession(params);
}
