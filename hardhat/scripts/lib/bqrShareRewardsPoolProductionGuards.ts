import {
  getAddress,
  parseEther,
  type Address,
} from "viem";

/** Canonical Base Mainnet BQR (B20 Asset). */
export const PRODUCTION_BQR_TOKEN = getAddress(
  "0xB200000000000000000000Bf7E6dcf0cF466939a",
);

/** Treasury / Ownable owner. Never the Hardhat deployer. */
export const PRODUCTION_POOL_OWNER = getAddress(
  "0xD34f706D5a5567FC0d45eFFa1623a37B66Ea41a2",
);

/** Dedicated authorize-only operator. Never treasury or deployer. */
export const PRODUCTION_POOL_OPERATOR = getAddress(
  "0x058A6B143B622aEAA876A6529969B2F97541e927",
);

export const HARDHAT_DEPLOYER = getAddress(
  "0x1819171c76D4B993ae6f14f43381b1Dfcd2AA09f",
);

export const TEST_ONLY_SHARE_POOL = getAddress(
  "0x75b99B36DDc4206A3c3A5d89436606e637003151",
);

export const OLD_LIVE_SHARE_POOL = getAddress(
  "0x967EdCDcf74d6793F1c6d09a1056ec66481513cB",
);

export const REWARDS_DISTRIBUTOR_ADDRESS = getAddress(
  "0x8DB0F6a276242787f8DA48360898cC3B5FC0bCe9",
);

export const BASE_MAINNET_CHAIN_ID = 8453;

export const PRODUCTION_REWARD_AMOUNT = parseEther("25");

export type ProductionDeployGuardInput = {
  chainId: number;
  initialOwner: Address;
  operator: Address;
  bqrToken: Address;
};

/**
 * Pre-broadcast checks for deployBqrShareRewardsPoolProduction.ts.
 * Throws before any deployment transaction.
 */
export function assertProductionDeployConstructorArgs(
  input: ProductionDeployGuardInput,
): void {
  if (input.chainId !== BASE_MAINNET_CHAIN_ID) {
    throw new Error(
      `Expected Base Mainnet (${BASE_MAINNET_CHAIN_ID}), got chainId ${input.chainId}`,
    );
  }

  if (getAddress(input.initialOwner) !== PRODUCTION_POOL_OWNER) {
    throw new Error(
      `initialOwner must be ${PRODUCTION_POOL_OWNER}, got ${getAddress(input.initialOwner)}`,
    );
  }

  if (getAddress(input.operator) !== PRODUCTION_POOL_OPERATOR) {
    throw new Error(
      `operator must be ${PRODUCTION_POOL_OPERATOR}, got ${getAddress(input.operator)}`,
    );
  }

  if (getAddress(input.operator) === getAddress(input.initialOwner)) {
    throw new Error("operator must not be the treasury owner");
  }

  if (getAddress(input.operator) === HARDHAT_DEPLOYER) {
    throw new Error("operator must not be the Hardhat deployer");
  }

  if (getAddress(input.bqrToken) !== PRODUCTION_BQR_TOKEN) {
    throw new Error(
      `BQR token must be ${PRODUCTION_BQR_TOKEN}, got ${getAddress(input.bqrToken)}`,
    );
  }
}

export function assertNotExistingSharePool(address: Address): void {
  const pool = getAddress(address);
  if (pool === TEST_ONLY_SHARE_POOL) {
    throw new Error("Refusing to use the TEST-ONLY Share Rewards pool");
  }
  if (pool === OLD_LIVE_SHARE_POOL) {
    throw new Error("Refusing to use the old live Share Rewards pool");
  }
  if (pool === REWARDS_DISTRIBUTOR_ADDRESS) {
    throw new Error("Refusing to use RewardsDistributor as the Share Rewards pool");
  }
}
