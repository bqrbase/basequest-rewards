import {
  getAddress,
  parseEther,
  type Address,
} from "viem";

/** Canonical Base Mainnet BQR (B20 Asset). */
export const BQR_TOKEN = getAddress(
  "0xB200000000000000000000Bf7E6dcf0cF466939a",
);

/**
 * Permanent BqrShareRewardsPool owner. Must never be the project deployer EOA.
 * Checksummed form of 0xd34f706d5a5567fc0d45effa1623a37b66ea41a2.
 */
export const POOL_INITIAL_OWNER = getAddress(
  "0xd34f706d5a5567fc0d45effa1623a37b66ea41a2",
);

/** Existing Merkle vault — must never be used as the Share Rewards pool. */
export const REWARDS_DISTRIBUTOR_ADDRESS = getAddress(
  "0x8DB0F6a276242787f8DA48360898cC3B5FC0bCe9",
);

export const BASE_MAINNET_CHAIN_ID = 8453;

export const SHARE_REWARD_AMOUNT = parseEther("25");

export type DeployConstructorGuardInput = {
  chainId: number;
  initialOwner: Address;
  bqrToken: Address;
};

/**
 * Pre-broadcast checks for deployBqrShareRewardsPool.ts.
 * Throws before any deployment transaction.
 */
export function assertDeployConstructorArgs(
  input: DeployConstructorGuardInput,
): void {
  if (input.chainId !== BASE_MAINNET_CHAIN_ID) {
    throw new Error(
      `Expected Base Mainnet (${BASE_MAINNET_CHAIN_ID}), got chainId ${input.chainId}`,
    );
  }

  if (getAddress(input.initialOwner) !== POOL_INITIAL_OWNER) {
    throw new Error(
      `initialOwner must be ${POOL_INITIAL_OWNER}, got ${getAddress(input.initialOwner)}`,
    );
  }

  if (getAddress(input.bqrToken) !== BQR_TOKEN) {
    throw new Error(
      `BQR token must be the Base Mainnet BQR ${BQR_TOKEN}, got ${getAddress(input.bqrToken)}`,
    );
  }
}

export type FundPoolGuardInput = {
  chainId: number;
  poolAddress: Address;
  deployer: Address;
  owner: Address;
  bqrToken: Address;
  rewardAmount: bigint;
};

/**
 * Pre-approve / pre-fund checks for fundBqrShareRewardsPool.ts.
 * Throws before any approve or fund transaction.
 */
export function assertFundPoolGuards(input: FundPoolGuardInput): void {
  if (input.chainId !== BASE_MAINNET_CHAIN_ID) {
    throw new Error(
      `Expected Base Mainnet (${BASE_MAINNET_CHAIN_ID}), got chainId=${input.chainId}`,
    );
  }

  const pool = getAddress(input.poolAddress);
  if (pool === REWARDS_DISTRIBUTOR_ADDRESS) {
    throw new Error(
      `Refusing to fund RewardsDistributor (${REWARDS_DISTRIBUTOR_ADDRESS}). Set BQR_SHARE_REWARDS_POOL to the BqrShareRewardsPool address.`,
    );
  }

  if (getAddress(input.owner) !== getAddress(input.deployer)) {
    throw new Error(
      `Signer ${getAddress(input.deployer)} is not pool owner ${getAddress(input.owner)}`,
    );
  }

  if (getAddress(input.bqrToken) !== BQR_TOKEN) {
    throw new Error(
      `Pool bqrToken mismatch: on-chain=${getAddress(input.bqrToken)} expected=${BQR_TOKEN}`,
    );
  }

  if (input.rewardAmount !== SHARE_REWARD_AMOUNT) {
    throw new Error(
      `Pool rewardAmount mismatch: on-chain=${input.rewardAmount.toString()} expected=${SHARE_REWARD_AMOUNT.toString()}`,
    );
  }
}
