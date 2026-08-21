import {
  createPublicClient,
  getAddress,
  http,
  isAddress,
  isHash,
  parseEventLogs,
  type Hash,
} from "viem";
import { base } from "viem/chains";
import {
  DAILY_CHECK_IN_ABI,
  DAILY_CHECK_IN_ADDRESS,
} from "@/lib/contracts/DailyCheckIn";
import { CHECK_IN_SELECTOR } from "@/lib/chain/questContracts";
import {
  verifyBaseTransactionWithRetry,
  type VerifyBaseTransactionResult,
} from "@/lib/chain/verifyBaseTransaction";

function getBaseRpcUrl(): string {
  return (
    process.env.BASE_RPC_URL ||
    process.env.NEXT_PUBLIC_BASE_RPC_URL ||
    "https://mainnet.base.org"
  );
}

/**
 * Base App / AA: bundler is tx.from; prove check-in via CheckedIn(user) log.
 */
async function verifyDailyCheckInViaCheckedInEvent(params: {
  txHash: Hash;
  walletAddress: string;
}): Promise<VerifyBaseTransactionResult> {
  const wallet = getAddress(params.walletAddress).toLowerCase();
  const checkIn = getAddress(DAILY_CHECK_IN_ADDRESS).toLowerCase();

  try {
    const client = createPublicClient({
      chain: base,
      transport: http(getBaseRpcUrl()),
    });
    const receipt = await client.getTransactionReceipt({
      hash: params.txHash,
    });

    if (!receipt) {
      return {
        ok: false,
        error: "receipt_not_found",
        message: "Transaction receipt not found on Base.",
      };
    }

    if (receipt.status !== "success") {
      return {
        ok: false,
        error: "tx_reverted",
        message: "Transaction reverted on Base.",
      };
    }

    const checkedInLogs = parseEventLogs({
      abi: DAILY_CHECK_IN_ABI,
      eventName: "CheckedIn",
      logs: receipt.logs,
    });

    const matched = checkedInLogs.find((log) => {
      const user = log.args.user;
      return (
        log.address.toLowerCase() === checkIn &&
        typeof user === "string" &&
        user.toLowerCase() === wallet
      );
    });

    if (!matched) {
      return {
        ok: false,
        error: "wallet_mismatch",
        message: "Transaction sender does not match the connected wallet.",
      };
    }

    const tx = await client.getTransaction({ hash: params.txHash });
    return {
      ok: true,
      receipt,
      txHash: params.txHash,
      from: getAddress(params.walletAddress),
      to: tx?.to ? getAddress(tx.to) : null,
      input: (tx?.input ?? "0x") as `0x${string}`,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to verify check-in transaction on Base.";
    return {
      ok: false,
      error: "rpc_error",
      message,
    };
  }
}

/**
 * EOA: tx.from === wallet (+ to/selector).
 * Smart-account / bundler: fallback to DailyCheckIn CheckedIn(user) log.
 */
export async function verifyDailyCheckInTransaction(params: {
  txHash: string;
  walletAddress: string;
}): Promise<VerifyBaseTransactionResult> {
  if (!isHash(params.txHash)) {
    return {
      ok: false,
      error: "invalid_tx_hash",
      message: "A valid transaction hash is required.",
    };
  }

  if (!isAddress(params.walletAddress)) {
    return {
      ok: false,
      error: "invalid_wallet",
      message: "A valid wallet address is required.",
    };
  }

  const eoaResult = await verifyBaseTransactionWithRetry({
    txHash: params.txHash,
    walletAddress: params.walletAddress,
    expectedTo: DAILY_CHECK_IN_ADDRESS,
    expectedFunctionSelector: CHECK_IN_SELECTOR,
  });

  if (eoaResult.ok) {
    return eoaResult;
  }

  // Bundler-submitted UserOps fail the EOA tx.from check first.
  if (eoaResult.error !== "wallet_mismatch") {
    return eoaResult;
  }

  return verifyDailyCheckInViaCheckedInEvent({
    txHash: params.txHash as Hash,
    walletAddress: params.walletAddress,
  });
}
