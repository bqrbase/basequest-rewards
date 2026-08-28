import { BQR_SHARE_REWARDS_POOL_ABI } from "@/lib/contracts/abi/BqrShareRewardsPool";
import {
  getBqrShareRewardsPoolAddress,
  isFarcasterMiniAppShareWallet,
  SHARE_POOL_CHAIN_ID,
  SHARE_POOL_REWARD_AMOUNT_WEI,
  toSharePoolCastHash,
} from "@/lib/contracts/shareRewardsPool";
import { walletsMatch } from "@/lib/task2earn/share-pool-flow";
import {
  BASE_MAINNET_REQUIRED_MESSAGE,
  ensureBaseMainnet,
  isBaseMainnetSwitchRejected,
} from "@/lib/wallet/ensureBaseMainnet";
import { sendFarcasterCallTransaction } from "@/lib/wallet/TransactionManager";
import {
  decodeErrorResult,
  encodeFunctionData,
  getAddress,
  parseEventLogs,
  type Address,
  type Hash,
  type Hex,
  type Log,
} from "viem";
import type { Config } from "wagmi";
import { getAccount, waitForTransactionReceipt } from "wagmi/actions";

export type ClaimSharePoolParams = {
  config: Config;
  chainId?: number;
  walletAddress: Address;
  fid: number;
  castHash: string;
  qualifiedWallet: Address;
  /** Server-resolved pool from Share Rewards campaign; falls back to env/default. */
  contractAddress?: Address;
};

export type ClaimSharePoolSuccess = {
  ok: true;
  status: "claimed";
  contractAddress: Address;
  fid: bigint;
  castHash: Hex;
  amount: bigint;
  txHash: Hash;
  chainId: number;
};

export type ClaimSharePoolFailure = {
  ok: false;
  status: "error";
  message: string;
};

export type ClaimSharePoolResult = ClaimSharePoolSuccess | ClaimSharePoolFailure;

const ERROR_MESSAGES: Record<string, string> = {
  ClaimAlreadyUsed: "This share reward was already claimed.",
  NotAuthorized: "This share reward is not authorized on-chain yet.",
  FidCooldown: "This Farcaster account already claimed within 24 hours.",
  InsufficientPoolBalance: "The share rewards pool does not have enough BQR.",
  EnforcedPause: "Share reward claims are temporarily paused.",
  InvalidFid: "Invalid Farcaster ID.",
  InvalidCastHash: "Invalid cast hash.",
  SafeERC20FailedOperation: "BQR transfer failed.",
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
          abi: BQR_SHARE_REWARDS_POOL_ABI,
          data,
        });
        return ERROR_MESSAGES[decoded.errorName] ?? decoded.errorName;
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

export function extractSharePoolClaimFromReceipt(
  logs: readonly Log[],
  params: { walletAddress: Address; fid: bigint; castHash: Hex },
): { amount: bigint; account: Address } | null {
  const claimedLogs = parseEventLogs({
    abi: BQR_SHARE_REWARDS_POOL_ABI,
    eventName: "ShareRewardClaimed",
    logs: [...logs],
  });
  const match = claimedLogs.find(
    (log) =>
      log.args.account?.toLowerCase() === params.walletAddress.toLowerCase() &&
      log.args.fid === params.fid &&
      log.args.castHash?.toLowerCase() === params.castHash.toLowerCase(),
  );
  if (!match?.args.amount || !match.args.account) {
    return null;
  }
  return {
    amount: match.args.amount,
    account: getAddress(match.args.account),
  };
}

/**
 * User-submitted claim(fid, castHash) through the Farcaster Mini App wallet.
 * Caller pays Base gas. Payout is always 25 BQR to msg.sender.
 * No signatures, relayers, or non-Farcaster wallets.
 */
export async function claimBqrShareReward(
  params: ClaimSharePoolParams,
): Promise<ClaimSharePoolResult> {
  if (!walletsMatch(params.walletAddress, params.qualifiedWallet)) {
    return {
      ok: false,
      status: "error",
      message: "Connect the same wallet that verified this share.",
    };
  }

  const contractAddress =
    params.contractAddress ?? getBqrShareRewardsPoolAddress();
  if (!contractAddress) {
    return {
      ok: false,
      status: "error",
      message: "Share rewards pool is not configured.",
    };
  }

  if (!params.fid || !Number.isInteger(params.fid) || params.fid <= 0) {
    return { ok: false, status: "error", message: ERROR_MESSAGES.InvalidFid };
  }

  let castHash: Hex;
  try {
    castHash = toSharePoolCastHash(params.castHash);
  } catch {
    return { ok: false, status: "error", message: ERROR_MESSAGES.InvalidCastHash };
  }

  const fid = BigInt(params.fid);
  const walletAddress = getAddress(params.walletAddress);

  try {
    const chainId = await ensureBaseMainnet({
      config: params.config,
      currentChainId: params.chainId,
    });
    if (chainId !== SHARE_POOL_CHAIN_ID) {
      return {
        ok: false,
        status: "error",
        message: BASE_MAINNET_REQUIRED_MESSAGE,
      };
    }

    const connector = getAccount(params.config).connector;
    if (!isFarcasterMiniAppShareWallet(connector)) {
      return {
        ok: false,
        status: "error",
        message: "Claim is only available in the Farcaster Mini App wallet.",
      };
    }

    const data = encodeFunctionData({
      abi: BQR_SHARE_REWARDS_POOL_ABI,
      functionName: "claim",
      args: [fid, castHash],
    });
    const hash = await sendFarcasterCallTransaction({
      config: params.config,
      chainId,
      to: contractAddress,
      data,
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

    const parsed = extractSharePoolClaimFromReceipt(receipt.logs, {
      walletAddress,
      fid,
      castHash,
    });
    if (!parsed || parsed.amount !== SHARE_POOL_REWARD_AMOUNT_WEI) {
      return {
        ok: false,
        status: "error",
        message: "Claim confirmed but the 25 BQR payout event was not found.",
      };
    }

    return {
      ok: true,
      status: "claimed",
      contractAddress,
      fid,
      castHash,
      amount: parsed.amount,
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
    console.error("[claimBqrShareReward]", error);
    return { ok: false, status: "error", message: getErrorMessage(error) };
  }
}
