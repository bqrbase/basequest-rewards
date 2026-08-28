/**
 * TEST-ONLY: on-chain qualifyShare is removed from BqrShareRewardsPool.
 * Verify never sends an owner transaction. Neynar is the eligibility authority.
 * This module remains only for unit-test guards and never broadcasts.
 */

import {
  BQR_SHARE_REWARDS_POOL_OWNER,
  getBqrShareRewardsPoolAddress,
  toSharePoolCastHash,
} from "@/lib/contracts/shareRewardsPool";
import { getAddress, type Address, type Hash, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export type QualifyShareInput = {
  account: Address;
  fid: number;
  castHash: string;
};

export type QualifyShareResult =
  | { ok: true; skipped: true; reason: string; txHash: null }
  | { ok: true; skipped: false; txHash: Hash }
  | { ok: false; skipped: false; error: string };

export function isSharePoolQualifyEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  void env;
  return false;
}

export function assertSharePoolOwnerKey(params: {
  privateKey: string;
  derivedAddress: Address;
}): void {
  if (getAddress(params.derivedAddress) !== getAddress(BQR_SHARE_REWARDS_POOL_OWNER)) {
    throw new Error(
      `Share pool owner key must derive ${BQR_SHARE_REWARDS_POOL_OWNER}, got ${params.derivedAddress}`,
    );
  }
  void params.privateKey;
}

export async function qualifyVerifiedShare(
  input: QualifyShareInput,
  deps?: {
    enabled?: boolean;
    writeQualifyShare?: (args: {
      account: Address;
      fid: bigint;
      castHash: Hex;
    }) => Promise<Hash>;
    env?: NodeJS.ProcessEnv;
  },
): Promise<QualifyShareResult> {
  const env = deps?.env ?? process.env;
  const enabled = deps?.enabled ?? isSharePoolQualifyEnabled(env);
  if (!enabled) {
    return {
      ok: true,
      skipped: true,
      reason: "qualify_disabled",
      txHash: null,
    };
  }

  if (!input.fid || !Number.isInteger(input.fid) || input.fid <= 0) {
    return { ok: false, skipped: false, error: "invalid_fid" };
  }

  const pool = getBqrShareRewardsPoolAddress();
  if (!pool) {
    return { ok: false, skipped: false, error: "pool_unconfigured" };
  }

  const castHash = toSharePoolCastHash(input.castHash);
  const account = getAddress(input.account);
  const fid = BigInt(input.fid);

  if (deps?.writeQualifyShare) {
    const txHash = await deps.writeQualifyShare({ account, fid, castHash });
    return { ok: true, skipped: false, txHash };
  }

  const rawKey = env.BQR_SHARE_POOL_OWNER_PRIVATE_KEY?.trim();
  if (!rawKey) {
    return {
      ok: true,
      skipped: true,
      reason: "owner_key_missing",
      txHash: null,
    };
  }

  const normalizedKey = (
    rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`
  ) as Hex;
  const ownerAccount = privateKeyToAccount(normalizedKey);
  try {
    assertSharePoolOwnerKey({
      privateKey: normalizedKey,
      derivedAddress: ownerAccount.address,
    });
  } catch (error) {
    return {
      ok: false,
      skipped: false,
      error: error instanceof Error ? error.message : "owner_mismatch",
    };
  }

  return {
    ok: true,
    skipped: true,
    reason: "qualify_removed_test_only",
    txHash: null,
  };
}
