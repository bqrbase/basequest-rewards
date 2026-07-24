import { BASEQUEST_BADGE_ABI } from "@/lib/contracts/abi/BaseQuestBadge";
import {
  decodeErrorResult,
  getAddress,
  isAddress,
  parseEventLogs,
  zeroAddress,
  type Address,
  type Hash,
  type Hex,
  type Log,
} from "viem";
import { base, baseSepolia } from "viem/chains";
import type { Config } from "wagmi";
import {
  readContract,
  waitForTransactionReceipt,
  writeContract,
} from "wagmi/actions";

export type ClaimBadgeParams = {
  config: Config;
  chainId?: number;
  walletAddress: Address;
  /** Optional ERC-8021 / builder attribution suffix. */
  dataSuffix?: Hex;
};

export type ClaimBadgeSuccess = {
  ok: true;
  status: "claimed";
  contractAddress: Address;
  tokenId: string;
  txHash: Hash;
  chainId: number;
};

export type ClaimBadgeFailure = {
  ok: false;
  status: "error";
  message: string;
};

export type ClaimBadgeResult = ClaimBadgeSuccess | ClaimBadgeFailure;

const SUPPORTED_CHAIN_IDS = [base.id, baseSepolia.id] as const;
type SupportedChainId = (typeof SUPPORTED_CHAIN_IDS)[number];

function isSupportedChainId(chainId: number): chainId is SupportedChainId {
  return (SUPPORTED_CHAIN_IDS as readonly number[]).includes(chainId);
}

export function getBaseQuestBadgeAddress(): Address | null {
  const raw = process.env.NEXT_PUBLIC_BASEQUEST_BADGE_ADDRESS?.trim();
  if (!raw || !isAddress(raw)) {
    return null;
  }
  return getAddress(raw);
}

export function getBaseScanAddressUrl(
  contractAddress: string,
  chainId: number,
): string {
  if (chainId === baseSepolia.id) {
    return `https://sepolia.basescan.org/address/${contractAddress}`;
  }
  return `https://basescan.org/address/${contractAddress}`;
}

export function getBaseScanNftUrl(
  contractAddress: string,
  tokenId: string,
  chainId: number,
): string {
  if (chainId === baseSepolia.id) {
    return `https://sepolia.basescan.org/nft/${contractAddress}/${tokenId}`;
  }
  return `https://basescan.org/nft/${contractAddress}/${tokenId}`;
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const record = error as {
      shortMessage?: string;
      message?: string;
      data?: Hex;
      cause?: { data?: Hex };
    };

    const data = record.data ?? record.cause?.data;
    if (data) {
      try {
        const decoded = decodeErrorResult({
          abi: BASEQUEST_BADGE_ABI,
          data,
        });
        if (decoded.errorName === "AlreadyMinted") {
          return "This wallet has already claimed the BaseQuest Builder Badge.";
        }
      } catch {
        // fall through
      }
    }

    const message = record.shortMessage || record.message;
    if (message) {
      if (/user rejected|denied|rejected the request/i.test(message)) {
        return "Transaction was rejected in your wallet.";
      }
      if (/AlreadyMinted/i.test(message)) {
        return "This wallet has already claimed the BaseQuest Builder Badge.";
      }
      return message;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return String(error);
}

function extractTokenIdFromReceipt(
  logs: readonly Log[],
  walletAddress: Address,
): string | null {
  const transferLogs = parseEventLogs({
    abi: BASEQUEST_BADGE_ABI,
    eventName: "Transfer",
    logs: [...logs],
  });

  const mintLog = transferLogs.find(
    (log) =>
      log.args.from?.toLowerCase() === zeroAddress &&
      log.args.to?.toLowerCase() === walletAddress.toLowerCase(),
  );

  if (mintLog?.args.tokenId === undefined) {
    return null;
  }

  return mintLog.args.tokenId.toString();
}

/**
 * Mint the BaseQuest Builder Badge with the connected wallet and wait for confirmation.
 */
export async function claimBaseQuestBadge(
  params: ClaimBadgeParams,
): Promise<ClaimBadgeResult> {
  const chainId = params.chainId ?? base.id;
  const contractAddress = getBaseQuestBadgeAddress();

  if (!contractAddress) {
    return {
      ok: false,
      status: "error",
      message:
        "Badge contract address is not configured (NEXT_PUBLIC_BASEQUEST_BADGE_ADDRESS).",
    };
  }

  if (!isSupportedChainId(chainId)) {
    return {
      ok: false,
      status: "error",
      message: "Switch to Base or Base Sepolia to claim the NFT.",
    };
  }

  try {
    const alreadyMinted = await readContract(params.config, {
      abi: BASEQUEST_BADGE_ABI,
      address: contractAddress,
      functionName: "hasMinted",
      args: [params.walletAddress],
      chainId,
    });

    if (alreadyMinted) {
      return {
        ok: false,
        status: "error",
        message: "This wallet has already claimed the BaseQuest Builder Badge.",
      };
    }

    const hash = await writeContract(params.config, {
      abi: BASEQUEST_BADGE_ABI,
      address: contractAddress,
      functionName: "claim",
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

    const tokenId = extractTokenIdFromReceipt(receipt.logs, params.walletAddress);
    if (!tokenId) {
      return {
        ok: false,
        status: "error",
        message: "Mint confirmed but token ID could not be parsed from events.",
      };
    }

    return {
      ok: true,
      status: "claimed",
      contractAddress,
      tokenId,
      txHash: hash,
      chainId,
    };
  } catch (error) {
    console.error("[claimBaseQuestBadge]", error);
    return {
      ok: false,
      status: "error",
      message: getErrorMessage(error),
    };
  }
}
