/**
 * Server-only operator authorization for BqrShareRewardsPoolProduction.
 *
 * The helper can encode/send only `authorize(account, fid, castHash)`.
 * It never funds, withdraws, pauses, or changes ownership.
 * It never reads BQR_SHARE_POOL_OWNER_PRIVATE_KEY or DEPLOYER_PRIVATE_KEY.
 *
 * Production is inactive until a dedicated pool address is configured and
 * BQR_SHARE_POOL_AUTHORIZE_ENABLED=true. Claim stays on the TEST pool until
 * that activation is explicitly approved.
 */

import {
  BQR_SHARE_REWARDS_POOL_OWNER,
  BQR_SHARE_REWARDS_POOL_PRODUCTION_ADDRESS,
  parseBqrShareRewardsPoolProductionAddress,
  SHARE_POOL_CHAIN_ID,
  toSharePoolCastHash,
} from "@/lib/contracts/shareRewardsPool";
import { getBaseRpcUrl } from "@/lib/rewards/server/baseClient";
import type { ShareCastProofReason } from "@/lib/task2earn/share-verify";
import {
  suppressShareRewardClaimable,
  type ShareRewardsCampaign,
} from "@/lib/task2earn/share-rewards-display";
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  getAddress,
  http,
  type Address,
  type Hash,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

/** Dedicated authorize-only operator. Never the treasury. */
export const BQR_SHARE_POOL_OPERATOR_ADDRESS =
  "0x058A6B143B622aEAA876A6529969B2F97541e927" as const;

const HARDHAT_DEPLOYER = "0x1819171c76D4B993ae6f14f43381b1Dfcd2AA09f" as const;

export { BQR_SHARE_REWARDS_POOL_PRODUCTION_ADDRESS };

/** Authorize-only subset of BqrShareRewardsPoolProduction. No owner methods. */
export const SHARE_POOL_AUTHORIZE_ABI = [
  {
    type: "function",
    name: "authorize",
    stateMutability: "nonpayable",
    inputs: [
      { name: "account", type: "address" },
      { name: "fid", type: "uint256" },
      { name: "castHash", type: "bytes32" },
    ],
    outputs: [],
  },
  { type: "error", name: "AlreadyAuthorized", inputs: [] },
  { type: "error", name: "ClaimAlreadyUsed", inputs: [] },
  { type: "error", name: "NotOperator", inputs: [] },
  { type: "error", name: "EnforcedPause", inputs: [] },
  { type: "error", name: "InvalidAccount", inputs: [] },
  { type: "error", name: "InvalidFid", inputs: [] },
  { type: "error", name: "InvalidCastHash", inputs: [] },
] as const;

const SHARE_POOL_AUTHORIZE_READ_ABI = [
  {
    type: "function",
    name: "getClaimId",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "fid", type: "uint256" },
      { name: "castHash", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "isAuthorized",
    stateMutability: "view",
    inputs: [{ name: "claimId", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export const SHARE_POOL_AUTHORIZE_FUNCTION = "authorize" as const;

export type ShareAuthorizeSkipReason =
  | ShareCastProofReason
  | "proof_failed"
  | "already_claimable"
  | "already_claimed"
  | "cooldown"
  | "pool_depleted"
  | "ledger_failed"
  | "ledger_duplicate";

export type ShareAuthorizeDecision =
  | { authorize: false; mode: "never"; reason: ShareAuthorizeSkipReason }
  | { authorize: true; mode: "required" | "idempotent"; reason: null };

export type AuthorizeShareInput = {
  account: Address | string;
  fid: number;
  castHash: string;
};

export type AuthorizeShareResult =
  | { ok: true; skipped: true; reason: string; txHash: null }
  | { ok: true; skipped: false; reason: "authorized"; txHash: Hash }
  | { ok: false; skipped: false; error: string; txHash: null };

export type AuthorizeShareDeps = {
  enabled?: boolean;
  env?: NodeJS.ProcessEnv;
  writeAuthorize?: (args: {
    account: Address;
    fid: bigint;
    castHash: Hex;
  }) => Promise<Hash>;
  readIsAuthorized?: (args: {
    account: Address;
    fid: bigint;
    castHash: Hex;
  }) => Promise<boolean>;
  logger?: (message: string) => void;
};

const PRIVATE_KEY_HEX = /0x[0-9a-fA-F]{64}/g;

export function redactSharePoolSecrets(value: string): string {
  return value.replace(PRIVATE_KEY_HEX, "0x[redacted]");
}

export function sharePoolAuthorizeWriteFunctions(): string[] {
  return SHARE_POOL_AUTHORIZE_ABI.filter((item) => item.type === "function").map(
    (item) => item.name,
  );
}

export function getBqrShareRewardsPoolProductionAddress(
  env: NodeJS.ProcessEnv = process.env,
): Address | null {
  return parseBqrShareRewardsPoolProductionAddress(env);
}

export function isSharePoolAuthorizeEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env.BQR_SHARE_POOL_AUTHORIZE_ENABLED !== "true") {
    return false;
  }
  try {
    return getBqrShareRewardsPoolProductionAddress(env) !== null;
  } catch {
    return false;
  }
}

export function shouldAuthorizeVerifiedShare(input: {
  proofOk: boolean;
  proofReason?: ShareCastProofReason | string | null;
  alreadyClaimable: boolean;
  claimedToday: boolean;
  cooldownActive: boolean;
  poolLive: boolean;
  ledgerInserted: boolean;
  ledgerDuplicate: boolean;
  ledgerConflict?: "duplicate" | "cooldown" | "pool_depleted" | "failed" | null;
}): ShareAuthorizeDecision {
  if (!input.proofOk) {
    const reason = input.proofReason;
    if (
      reason === "reply" ||
      reason === "recast_or_quote" ||
      reason === "wrong_task_url" ||
      reason === "stale_cast" ||
      reason === "listing_url" ||
      reason === "url_in_text_only" ||
      reason === "wrong_author" ||
      reason === "missing_cast" ||
      reason === "before_task" ||
      reason === "unfetchable"
    ) {
      return { authorize: false, mode: "never", reason };
    }
    return { authorize: false, mode: "never", reason: "proof_failed" };
  }
  if (!input.poolLive) {
    return { authorize: false, mode: "never", reason: "pool_depleted" };
  }
  if (input.claimedToday || input.cooldownActive) {
    return { authorize: false, mode: "never", reason: "cooldown" };
  }
  if (input.ledgerConflict === "pool_depleted") {
    return { authorize: false, mode: "never", reason: "pool_depleted" };
  }
  if (input.ledgerConflict === "cooldown") {
    return { authorize: false, mode: "never", reason: "cooldown" };
  }
  if (input.ledgerConflict === "failed") {
    return { authorize: false, mode: "never", reason: "ledger_failed" };
  }
  if (
    input.alreadyClaimable ||
    input.ledgerDuplicate ||
    input.ledgerConflict === "duplicate"
  ) {
    return { authorize: true, mode: "idempotent", reason: null };
  }
  if (!input.ledgerInserted) {
    return { authorize: false, mode: "never", reason: "ledger_failed" };
  }
  return { authorize: true, mode: "required", reason: null };
}

export function assertSharePoolOperatorKey(params: {
  derivedAddress: Address;
}): void {
  const derived = getAddress(params.derivedAddress);
  if (derived !== getAddress(BQR_SHARE_POOL_OPERATOR_ADDRESS)) {
    throw new Error(
      `Share pool operator key must derive ${BQR_SHARE_POOL_OPERATOR_ADDRESS}, got ${derived}`,
    );
  }
  if (derived === getAddress(BQR_SHARE_REWARDS_POOL_OWNER)) {
    throw new Error("Share pool operator key must not be the treasury owner");
  }
  if (derived === getAddress(HARDHAT_DEPLOYER)) {
    throw new Error("Share pool operator key must not be the Hardhat deployer");
  }
}

function operatorPrivateKeyFromEnv(env: NodeJS.ProcessEnv): Hex | null {
  const raw = env.BQR_SHARE_POOL_OPERATOR_PRIVATE_KEY?.trim();
  if (!raw) {
    return null;
  }
  const normalized = (raw.startsWith("0x") ? raw : `0x${raw}`) as Hex;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    return null;
  }
  return normalized;
}

function logAuthorizeError(
  logger: ((message: string) => void) | undefined,
  error: unknown,
): void {
  const message = redactSharePoolSecrets(
    error instanceof Error ? error.message : "authorize_failed",
  );
  const log = logger ?? ((value: string) => console.error("[share-pool-authorize]", value));
  log(message);
}

function isAlreadyAuthorizedError(error: unknown): boolean {
  const text = redactSharePoolSecrets(
    error instanceof Error ? `${error.name} ${error.message}` : String(error),
  );
  return /AlreadyAuthorized/i.test(text);
}

export function encodeSharePoolAuthorizeCall(params: {
  account: Address;
  fid: bigint;
  castHash: Hex;
}): Hex {
  return encodeFunctionData({
    abi: SHARE_POOL_AUTHORIZE_ABI,
    functionName: SHARE_POOL_AUTHORIZE_FUNCTION,
    args: [params.account, params.fid, params.castHash],
  });
}

async function readOnChainAuthorized(params: {
  pool: Address;
  account: Address;
  fid: bigint;
  castHash: Hex;
}): Promise<boolean> {
  const client = createPublicClient({
    chain: base,
    transport: http(getBaseRpcUrl()),
  });
  const claimId = await client.readContract({
    address: params.pool,
    abi: SHARE_POOL_AUTHORIZE_READ_ABI,
    functionName: "getClaimId",
    args: [params.account, params.fid, params.castHash],
  });
  return client.readContract({
    address: params.pool,
    abi: SHARE_POOL_AUTHORIZE_READ_ABI,
    functionName: "isAuthorized",
    args: [claimId],
  });
}

async function broadcastAuthorize(params: {
  pool: Address;
  account: Address;
  fid: bigint;
  castHash: Hex;
  privateKey: Hex;
}): Promise<Hash> {
  const operatorAccount = privateKeyToAccount(params.privateKey);
  assertSharePoolOperatorKey({ derivedAddress: operatorAccount.address });
  const walletClient = createWalletClient({
    account: operatorAccount,
    chain: base,
    transport: http(getBaseRpcUrl()),
  });
  const data = encodeSharePoolAuthorizeCall({
    account: params.account,
    fid: params.fid,
    castHash: params.castHash,
  });
  const chainId = await walletClient.getChainId();
  if (chainId !== SHARE_POOL_CHAIN_ID) {
    throw new Error(`Expected Base Mainnet (${SHARE_POOL_CHAIN_ID}), got ${chainId}`);
  }
  return walletClient.sendTransaction({
    to: params.pool,
    data,
    chain: base,
  });
}

/**
 * Apply operator authorization outcome to campaign UI state.
 * When production authorize is disabled, pending ledger rows stay claimable (TEST pool).
 * When enabled, Claim is shown only after authorization succeeds (or is already on-chain).
 */
export function applySharePoolAuthorizationToCampaign(
  campaign: ShareRewardsCampaign,
  auth: AuthorizeShareResult,
): { campaign: ShareRewardsCampaign; qualifiedOnchain: boolean } {
  if (auth.ok && auth.skipped && auth.reason === "authorize_disabled") {
    return { campaign, qualifiedOnchain: false };
  }
  if (auth.ok) {
    const hasPendingIdentity = Boolean(
      campaign.claimFid && campaign.claimCastHash && campaign.qualifiedWallet,
    );
    return {
      campaign: {
        ...campaign,
        claimable: hasPendingIdentity,
      },
      qualifiedOnchain: true,
    };
  }
  return {
    campaign: suppressShareRewardClaimable(campaign),
    qualifiedOnchain: false,
  };
}

export async function authorizeVerifiedShare(
  input: AuthorizeShareInput,
  deps?: AuthorizeShareDeps,
): Promise<AuthorizeShareResult> {
  const env = deps?.env ?? process.env;
  const enabled = deps?.enabled ?? isSharePoolAuthorizeEnabled(env);
  if (!enabled) {
    return {
      ok: true,
      skipped: true,
      reason: "authorize_disabled",
      txHash: null,
    };
  }

  if (!input.fid || !Number.isInteger(input.fid) || input.fid <= 0) {
    return { ok: false, skipped: false, error: "invalid_fid", txHash: null };
  }

  let pool: Address;
  try {
    const configured = getBqrShareRewardsPoolProductionAddress(env);
    if (!configured) {
      return {
        ok: false,
        skipped: false,
        error: "production_pool_unconfigured",
        txHash: null,
      };
    }
    pool = configured;
  } catch (error) {
    return {
      ok: false,
      skipped: false,
      error: redactSharePoolSecrets(
        error instanceof Error ? error.message : "production_pool_unconfigured",
      ),
      txHash: null,
    };
  }

  let account: Address;
  let castHash: Hex;
  try {
    account = getAddress(input.account);
    castHash = toSharePoolCastHash(input.castHash);
  } catch (error) {
    return {
      ok: false,
      skipped: false,
      error: redactSharePoolSecrets(
        error instanceof Error ? error.message : "invalid_authorize_args",
      ),
      txHash: null,
    };
  }
  const fid = BigInt(input.fid);

  try {
    const already = deps?.readIsAuthorized
      ? await deps.readIsAuthorized({ account, fid, castHash })
      : deps?.writeAuthorize
        ? false
        : await readOnChainAuthorized({ pool, account, fid, castHash });
    if (already) {
      return {
        ok: true,
        skipped: true,
        reason: "already_authorized",
        txHash: null,
      };
    }
  } catch {
    // View failure is not a grant. Continue to authorize when a write path exists.
  }

  if (deps?.writeAuthorize) {
    try {
      const txHash = await deps.writeAuthorize({ account, fid, castHash });
      return { ok: true, skipped: false, reason: "authorized", txHash };
    } catch (error) {
      if (isAlreadyAuthorizedError(error)) {
        return {
          ok: true,
          skipped: true,
          reason: "already_authorized",
          txHash: null,
        };
      }
      logAuthorizeError(deps.logger, error);
      return {
        ok: false,
        skipped: false,
        error: redactSharePoolSecrets(
          error instanceof Error ? error.message : "authorize_failed",
        ),
        txHash: null,
      };
    }
  }

  const privateKey = operatorPrivateKeyFromEnv(env);
  if (!privateKey) {
    return {
      ok: false,
      skipped: false,
      error: "operator_key_missing",
      txHash: null,
    };
  }

  try {
    const operatorAccount = privateKeyToAccount(privateKey);
    assertSharePoolOperatorKey({ derivedAddress: operatorAccount.address });
    const txHash = await broadcastAuthorize({
      pool,
      account,
      fid,
      castHash,
      privateKey,
    });
    return { ok: true, skipped: false, reason: "authorized", txHash };
  } catch (error) {
    if (isAlreadyAuthorizedError(error)) {
      return {
        ok: true,
        skipped: true,
        reason: "already_authorized",
        txHash: null,
      };
    }
    logAuthorizeError(deps?.logger, error);
    return {
      ok: false,
      skipped: false,
      error: redactSharePoolSecrets(
        error instanceof Error ? error.message : "authorize_failed",
      ),
      txHash: null,
    };
  }
}
