import { getAddress, isAddress, toFunctionSelector, type Address, type Hex } from "viem";
import { BASEQUEST_GENESIS_ADDRESS } from "@/lib/contracts/abi/BaseQuestGenesis";
import { DAILY_CHECK_IN_ADDRESS } from "@/lib/contracts/DailyCheckIn";

export const CHECK_IN_SELECTOR = toFunctionSelector("checkIn()");
export const BADGE_CLAIM_SELECTOR = toFunctionSelector("claim()");
export const GENESIS_MINT_SELECTOR = toFunctionSelector(
  "mint(address,uint256,bytes)",
);
export const REWARDS_CLAIM_SELECTOR = toFunctionSelector(
  "claim(uint256,bytes32,uint256,bytes32[])",
);

export function getDailyCheckInAddress(): Address {
  return getAddress(DAILY_CHECK_IN_ADDRESS);
}

export function getBadgeContractAddress(): Address | null {
  const raw = process.env.NEXT_PUBLIC_BASEQUEST_BADGE_ADDRESS?.trim();
  if (!raw || !isAddress(raw)) {
    return null;
  }
  return getAddress(raw);
}

export function getGenesisContractAddress(): Address {
  return getAddress(BASEQUEST_GENESIS_ADDRESS);
}

export function getRewardsDistributorAddress(): Address | null {
  const raw = process.env.NEXT_PUBLIC_REWARDS_DISTRIBUTOR?.trim();
  if (!raw || !isAddress(raw)) {
    return null;
  }
  return getAddress(raw);
}

export type QuestTxExpectation = {
  expectedTo?: Address;
  expectedFunctionSelector?: Hex;
  allowContractCreation?: boolean;
};
