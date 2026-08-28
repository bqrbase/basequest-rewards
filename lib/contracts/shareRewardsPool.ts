import { getAddress, hexToBytes, isAddress, isHex, pad, type Address, type Hex } from "viem";
import { normalizeCastHash } from "../task2earn/verification-logic";

/**
 * TEST-ONLY Base Mainnet BqrShareRewardsPool (explicit fallback for claim routing).
 * Do not use the live pool 0x967EdCDcf74d6793F1c6d09a1056ec66481513cB.
 */
export const BQR_SHARE_REWARDS_POOL_ADDRESS =
  "0x75b99B36DDc4206A3c3A5d89436606e637003151" as const;

/** Alias for tests and controlled cutover docs. Same as BQR_SHARE_REWARDS_POOL_ADDRESS. */
export const BQR_SHARE_REWARDS_POOL_TEST_ADDRESS = BQR_SHARE_REWARDS_POOL_ADDRESS;

/** Deployed BqrShareRewardsPoolProduction on Base Mainnet. Inactive until env gates are set. */
export const BQR_SHARE_REWARDS_POOL_PRODUCTION_ADDRESS =
  "0x8f5c7b6AcA62Ed899A0A8E2B1edA6Aa56D6A4814" as const;

const OLD_LIVE_SHARE_POOL =
  "0x967EdCDcf74d6793F1c6d09a1056ec66481513cB" as const;
const BQR_SHARE_POOL_OPERATOR =
  "0x058A6B143B622aEAA876A6529969B2F97541e927" as const;
const HARDHAT_DEPLOYER =
  "0x1819171c76D4B993ae6f14f43381b1Dfcd2AA09f" as const;

/** Permanent on-chain owner. Never the Hardhat deployer EOA. */
export const BQR_SHARE_REWARDS_POOL_OWNER =
  "0xD34f706D5a5567FC0d45eFFa1623a37B66Ea41a2" as const;

export const REWARDS_DISTRIBUTOR_ADDRESS =
  "0x8DB0F6a276242787f8DA48360898cC3B5FC0bCe9" as const;

export const SHARE_POOL_REWARD_AMOUNT_WEI = 25n * 10n ** 18n;
export const SHARE_POOL_CHAIN_ID = 8453;

export function getBqrShareRewardsPoolTestAddress(): Address {
  return getAddress(BQR_SHARE_REWARDS_POOL_TEST_ADDRESS);
}

function assertShareRewardsClaimPoolAllowed(address: Address): Address {
  if (address === getAddress(REWARDS_DISTRIBUTOR_ADDRESS)) {
    throw new Error(
      "BqrShareRewardsPool address must not be RewardsDistributor",
    );
  }
  return address;
}

/**
 * Production pool from `BQR_SHARE_REWARDS_POOL_PRODUCTION` only.
 * Never infers production from the baked-in constant alone (authorize/claim gates require env).
 */
export function parseBqrShareRewardsPoolProductionAddress(
  env: NodeJS.ProcessEnv = process.env,
): Address | null {
  const raw = env.BQR_SHARE_REWARDS_POOL_PRODUCTION?.trim();
  if (!raw || raw === "null") {
    return null;
  }
  try {
    const address = assertShareRewardsClaimPoolAllowed(getAddress(raw));
    if (
      address === getBqrShareRewardsPoolTestAddress() ||
      address === getAddress(OLD_LIVE_SHARE_POOL) ||
      address === getAddress(BQR_SHARE_REWARDS_POOL_OWNER) ||
      address === getAddress(BQR_SHARE_POOL_OPERATOR) ||
      address === getAddress(HARDHAT_DEPLOYER)
    ) {
      throw new Error("production_pool_address_forbidden");
    }
    return address;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "production_pool_address_forbidden"
    ) {
      throw error;
    }
    return null;
  }
}

/** Controlled production claim cutover (server/runtime only). Requires production env address. */
export function isSharePoolClaimProductionEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env.BQR_SHARE_POOL_CLAIM_PRODUCTION_ENABLED !== "true") {
    return false;
  }
  try {
    return parseBqrShareRewardsPoolProductionAddress(env) !== null;
  } catch {
    return false;
  }
}

/**
 * Claim pool resolution order:
 * 1. `NEXT_PUBLIC_BQR_SHARE_REWARDS_POOL` when set (explicit public override)
 * 2. Production pool when `BQR_SHARE_POOL_CLAIM_PRODUCTION_ENABLED=true` and production env is set
 * 3. TEST-ONLY fallback `0x75b99…3151`
 */
export function resolveShareRewardsClaimPoolAddress(
  env: NodeJS.ProcessEnv = process.env,
): Address {
  const explicitPublic = env.NEXT_PUBLIC_BQR_SHARE_REWARDS_POOL?.trim();
  if (explicitPublic && isAddress(explicitPublic, { strict: false })) {
    return assertShareRewardsClaimPoolAllowed(getAddress(explicitPublic));
  }
  if (isSharePoolClaimProductionEnabled(env)) {
    const production = parseBqrShareRewardsPoolProductionAddress(env);
    if (production) {
      return production;
    }
  }
  return getBqrShareRewardsPoolTestAddress();
}

/**
 * Resolved Share Rewards claim pool. Prefer `campaign.claimPoolAddress` on the client when present.
 */
export function getBqrShareRewardsPoolAddress(
  env: NodeJS.ProcessEnv = process.env,
): Address | null {
  try {
    return resolveShareRewardsClaimPoolAddress(env);
  } catch {
    return null;
  }
}

/**
 * ABI `bytes32` encoding of a Farcaster cast hash (typically 20 bytes).
 * Left-pads to 32 bytes so claim uses a consistent bytes32.
 */
export function toSharePoolCastHash(raw: string): Hex {
  const normalized = normalizeCastHash(raw);
  if (!normalized || !isHex(normalized)) {
    throw new Error("invalid_cast_hash");
  }
  const bytes = hexToBytes(normalized);
  if (bytes.length === 0 || bytes.length > 32) {
    throw new Error("invalid_cast_hash");
  }
  return pad(normalized, { size: 32 });
}

export function sharePoolRewardAmountWei(): bigint {
  return SHARE_POOL_REWARD_AMOUNT_WEI;
}

/**
 * Share Rewards Claim is Farcaster Mini App wallet only.
 * Refuses Base Account, Coinbase Wallet, injected, and WalletConnect.
 */
export function isFarcasterMiniAppShareWallet(
  connector?: { id?: string; type?: string } | null,
): boolean {
  if (!connector) {
    return false;
  }
  const id = connector.id?.trim() ?? "";
  const type = connector.type?.trim() ?? "";
  if (
    id === "baseAccount" ||
    type === "baseAccount" ||
    id === "coinbaseWalletSDK" ||
    id === "coinbaseWallet" ||
    type === "coinbaseWalletSDK" ||
    id === "injected" ||
    id === "walletConnect" ||
    id === "metaMask"
  ) {
    return false;
  }
  return (
    id === "farcaster" ||
    type === "farcasterMiniApp" ||
    type === "farcasterFrame"
  );
}
