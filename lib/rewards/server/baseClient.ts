import { REWARDS_DISTRIBUTOR_ABI } from "@/lib/contracts/abi/RewardsDistributor";
import { getRewardsDistributorAddress } from "@/lib/contracts/claim/rewardsDistributor";
import { getBqrTokenAddress } from "@/lib/token/bqr";
import { DEFAULT_BQR_DECIMALS } from "@/lib/rewards/amounts";
import {
  createPublicClient,
  erc20Abi,
  http,
  type Address,
  type Hex,
} from "viem";
import { base } from "viem/chains";

function createBaseClient() {
  return createPublicClient({
    chain: base,
    transport: http(getBaseRpcUrl()),
  });
}

type BasePublicClient = ReturnType<typeof createBaseClient>;

let cachedClient: BasePublicClient | null = null;

export function getBaseRpcUrl(): string {
  return (
    process.env.BASE_RPC_URL?.trim() ||
    process.env.NEXT_PUBLIC_BASE_RPC_URL?.trim() ||
    "https://mainnet.base.org"
  );
}

export function getBasePublicClient(): BasePublicClient {
  if (!cachedClient) {
    cachedClient = createBaseClient();
  }
  return cachedClient;
}

export function requireDistributorAddress(): Address {
  const address = getRewardsDistributorAddress();
  if (!address) {
    throw new Error(
      "NEXT_PUBLIC_REWARDS_DISTRIBUTOR is not configured",
    );
  }
  return address;
}

export async function readIsClaimed(params: {
  campaignId: bigint;
  account: Address;
  rewardId: Hex;
}): Promise<boolean> {
  const client = getBasePublicClient();
  const address = requireDistributorAddress();
  return client.readContract({
    abi: REWARDS_DISTRIBUTOR_ABI,
    address,
    functionName: "isClaimed",
    args: [params.campaignId, params.account, params.rewardId],
  });
}

export async function readOnChainCampaign(campaignId: bigint): Promise<{
  merkleRoot: Hex;
  startTime: bigint;
  endTime: bigint;
  active: boolean;
  campaignType: number;
}> {
  const client = getBasePublicClient();
  const address = requireDistributorAddress();
  const campaign = await client.readContract({
    abi: REWARDS_DISTRIBUTOR_ABI,
    address,
    functionName: "getCampaign",
    args: [campaignId],
  });
  return {
    merkleRoot: campaign.merkleRoot,
    startTime: campaign.startTime,
    endTime: campaign.endTime,
    active: campaign.active,
    campaignType: campaign.campaignType,
  };
}

export async function readBqrDecimals(): Promise<number> {
  try {
    const client = getBasePublicClient();
    const decimals = await client.readContract({
      abi: erc20Abi,
      address: getBqrTokenAddress(),
      functionName: "decimals",
    });
    return Number(decimals);
  } catch {
    return DEFAULT_BQR_DECIMALS;
  }
}
