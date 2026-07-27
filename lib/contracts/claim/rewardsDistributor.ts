import { REWARDS_DISTRIBUTOR_ABI } from "@/lib/contracts/abi/RewardsDistributor";
import {
  BASE_MAINNET_REQUIRED_MESSAGE,
  ensureBaseMainnet,
  isBaseMainnetSwitchRejected,
} from "@/lib/wallet/ensureBaseMainnet";
import {
  decodeErrorResult,
  getAddress,
  isAddress,
  parseEventLogs,
  type Address,
  type Hash,
  type Hex,
  type Log,
} from "viem";
import { base } from "viem/chains";
import type { Config } from "wagmi";
import {
  readContract,
  waitForTransactionReceipt,
  writeContract,
} from "wagmi/actions";

export type ClaimRewardsDistributorParams = {
  config: Config;
  chainId?: number;
  /** Connected wallet; used for preflight `isClaimed` and event matching. */
  walletAddress: Address;
  campaignId: bigint;
  rewardId: Hex;
  /** BQR amount in base units (wei). */
  amount: bigint;
  merkleProof: readonly Hex[];
  /** Optional ERC-8021 / builder attribution suffix. */
  dataSuffix?: Hex;
};

export type ClaimRewardsDistributorSuccess = {
  ok: true;
  status: "claimed";
  contractAddress: Address;
  campaignId: bigint;
  rewardId: Hex;
  amount: bigint;
  claimId: Hex;
  txHash: Hash;
  chainId: number;
};

export type ClaimRewardsDistributorFailure = {
  ok: false;
  status: "error";
  message: string;
};

export type ClaimRewardsDistributorResult =
  | ClaimRewardsDistributorSuccess
  | ClaimRewardsDistributorFailure;

const BASE_MAINNET_CHAIN_ID = base.id;

function isBaseMainnet(chainId: number): boolean {
  return chainId === BASE_MAINNET_CHAIN_ID;
}

/** Base Mainnet RewardsDistributor (production). Override via env. */
export const REWARDS_DISTRIBUTOR_ADDRESS =
  "0x8DB0F6a276242787f8DA48360898cC3B5FC0bCe9" as const;

/**
 * RewardsDistributor address from `NEXT_PUBLIC_REWARDS_DISTRIBUTOR`,
 * falling back to the deployed Base Mainnet address.
 */
export function getRewardsDistributorAddress(): Address | null {
  const raw =
    process.env.NEXT_PUBLIC_REWARDS_DISTRIBUTOR?.trim() ||
    REWARDS_DISTRIBUTOR_ADDRESS;
  // Accept non-checksummed hex; viem isAddress(strict) rejects mixed-case typos.
  if (!raw || !isAddress(raw, { strict: false })) {
    return null;
  }
  return getAddress(raw);
}

export function getBaseScanTxUrl(txHash: string): string {
  return `https://basescan.org/tx/${txHash}`;
}

const ERROR_MESSAGES: Record<string, string> = {
  AlreadyClaimed: "This reward has already been claimed.",
  CampaignEnded: "This rewards campaign has ended.",
  CampaignInactive: "This rewards campaign is not active.",
  CampaignNotFound: "Rewards campaign not found.",
  CampaignNotStarted: "This rewards campaign has not started yet.",
  ClaimKeyZero: "Invalid reward id.",
  EnforcedPause: "Reward claims are temporarily paused.",
  InvalidAmount: "Claim amount must be greater than zero.",
  InvalidProof: "Invalid Merkle proof for this claim.",
  RootNotSet: "Campaign Merkle root is not set.",
  ZeroAddress: "Invalid address.",
  SafeERC20FailedOperation:
    "Token transfer failed. The distributor may have insufficient BQR.",
  InsufficientBalance:
    "The rewards vault has insufficient BQR to pay this claim.",
  InsufficientDistributorBalance:
    "The rewards vault has insufficient BQR to pay this claim.",
  ReentrancyGuardReentrantCall: "Claim failed due to a reentrancy guard.",
};

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const record = error as {
      shortMessage?: string;
      message?: string;
      data?: Hex;
      cause?: { data?: Hex; shortMessage?: string; message?: string };
    };

    const data = record.data ?? record.cause?.data;
    if (data) {
      try {
        const decoded = decodeErrorResult({
          abi: REWARDS_DISTRIBUTOR_ABI,
          data,
        });
        const mapped = ERROR_MESSAGES[decoded.errorName];
        if (mapped) {
          return mapped;
        }
        return decoded.errorName;
      } catch {
        // fall through
      }
    }

    const message =
      record.shortMessage ||
      record.message ||
      record.cause?.shortMessage ||
      record.cause?.message;

    if (message) {
      if (/user rejected|denied|rejected the request/i.test(message)) {
        return "Transaction was rejected in your wallet.";
      }
      for (const [name, friendly] of Object.entries(ERROR_MESSAGES)) {
        if (message.includes(name)) {
          return friendly;
        }
      }
      return message;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return String(error);
}

function extractClaimIdFromReceipt(
  logs: readonly Log[],
  params: {
    walletAddress: Address;
    campaignId: bigint;
    rewardId: Hex;
  },
): Hex | null {
  const claimedLogs = parseEventLogs({
    abi: REWARDS_DISTRIBUTOR_ABI,
    eventName: "RewardClaimed",
    logs: [...logs],
  });

  const match = claimedLogs.find(
    (log) =>
      log.args.account?.toLowerCase() === params.walletAddress.toLowerCase() &&
      log.args.campaignId === params.campaignId &&
      log.args.rewardId?.toLowerCase() === params.rewardId.toLowerCase(),
  );

  return match?.args.claimId ?? null;
}

/**
 * Claim BQR from RewardsDistributor with a Merkle proof and wait for confirmation.
 * Switches the wallet to Base Mainnet (8453) via ensureBaseMainnet before any write.
 *
 * Does not generate proofs — callers supply `merkleProof` (future Merkle backend).
 */
export async function claimRewardsDistributor(
  params: ClaimRewardsDistributorParams,
): Promise<ClaimRewardsDistributorResult> {
  const contractAddress = getRewardsDistributorAddress();

  if (!contractAddress) {
    return {
      ok: false,
      status: "error",
      message:
        "Rewards distributor address is not configured (NEXT_PUBLIC_REWARDS_DISTRIBUTOR).",
    };
  }

  if (params.amount <= BigInt(0)) {
    return {
      ok: false,
      status: "error",
      message: ERROR_MESSAGES.InvalidAmount,
    };
  }

  if (
    params.rewardId ===
    "0x0000000000000000000000000000000000000000000000000000000000000000"
  ) {
    return {
      ok: false,
      status: "error",
      message: ERROR_MESSAGES.ClaimKeyZero,
    };
  }

  try {
    const chainId = await ensureBaseMainnet({
      config: params.config,
      currentChainId: params.chainId,
    });

    if (!isBaseMainnet(chainId)) {
      return {
        ok: false,
        status: "error",
        message: BASE_MAINNET_REQUIRED_MESSAGE,
      };
    }

    const alreadyClaimed = await readContract(params.config, {
      abi: REWARDS_DISTRIBUTOR_ABI,
      address: contractAddress,
      functionName: "isClaimed",
      args: [params.campaignId, params.walletAddress, params.rewardId],
      chainId,
    });

    if (alreadyClaimed) {
      return {
        ok: false,
        status: "error",
        message: ERROR_MESSAGES.AlreadyClaimed,
      };
    }

    const hash = await writeContract(params.config, {
      abi: REWARDS_DISTRIBUTOR_ABI,
      address: contractAddress,
      functionName: "claim",
      args: [
        params.campaignId,
        params.rewardId,
        params.amount,
        [...params.merkleProof],
      ],
      chainId,
      ...(params.dataSuffix ? { dataSuffix: params.dataSuffix } : {}),
    });

    const receipt = await waitForTransactionReceipt(params.config, {
      hash,
      confirmations: 1,
    });

    if (receipt.status !== "success") {
      return {
        ok: false,
        status: "error",
        message: "Claim transaction reverted.",
      };
    }

    const claimId = extractClaimIdFromReceipt(receipt.logs, {
      walletAddress: params.walletAddress,
      campaignId: params.campaignId,
      rewardId: params.rewardId,
    });

    if (!claimId) {
      return {
        ok: false,
        status: "error",
        message:
          "Claim confirmed but claim ID could not be parsed from events.",
      };
    }

    return {
      ok: true,
      status: "claimed",
      contractAddress,
      campaignId: params.campaignId,
      rewardId: params.rewardId,
      amount: params.amount,
      claimId,
      txHash: hash,
      chainId,
    };
  } catch (error) {
    if (isBaseMainnetSwitchRejected(error)) {
      return {
        ok: false,
        status: "error",
        message: BASE_MAINNET_REQUIRED_MESSAGE,
      };
    }

    console.error("[claimRewardsDistributor]", error);
    return {
      ok: false,
      status: "error",
      message: getErrorMessage(error),
    };
  }
}
