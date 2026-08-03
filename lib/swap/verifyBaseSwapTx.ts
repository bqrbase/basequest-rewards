import {
  createPublicClient,
  http,
  isHash,
  type Hash,
  type TransactionReceipt,
} from "viem";
import { base } from "viem/chains";

export type VerifyBaseSwapTxResult =
  | {
      ok: true;
      receipt: TransactionReceipt;
      txHash: Hash;
    }
  | {
      ok: false;
      error:
        | "invalid_tx_hash"
        | "receipt_not_found"
        | "tx_reverted"
        | "wallet_mismatch"
        | "rpc_error";
      message: string;
    };

function getBaseRpcUrl(): string {
  return (
    process.env.BASE_RPC_URL ||
    process.env.NEXT_PUBLIC_BASE_RPC_URL ||
    "https://mainnet.base.org"
  );
}

/**
 * Confirm a swap transaction on Base Mainnet via the official RPC receipt.
 * Never treats pending / missing / reverted txs as success.
 */
export async function verifyBaseSwapTx(params: {
  txHash: string;
  walletAddress: string;
}): Promise<VerifyBaseSwapTxResult> {
  if (!isHash(params.txHash)) {
    return {
      ok: false,
      error: "invalid_tx_hash",
      message: "A valid transaction hash is required.",
    };
  }

  const txHash = params.txHash as Hash;
  const wallet = params.walletAddress.toLowerCase();

  try {
    const client = createPublicClient({
      chain: base,
      transport: http(getBaseRpcUrl()),
    });

    const receipt = await client.getTransactionReceipt({ hash: txHash });

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

    // Queried against Base Mainnet RPC — receipt presence implies Base.
    const tx = await client.getTransaction({ hash: txHash });
    if (!tx?.from || tx.from.toLowerCase() !== wallet) {
      return {
        ok: false,
        error: "wallet_mismatch",
        message: "Transaction sender does not match the connected wallet.",
      };
    }

    return { ok: true, receipt, txHash };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to verify transaction on Base.";
    const name =
      error && typeof error === "object" && "name" in error
        ? String((error as { name?: unknown }).name)
        : "";

    // Viem throws when the receipt is not yet indexed on the RPC.
    if (
      name.includes("TransactionReceiptNotFound") ||
      /receipt.*not found|could not be found/i.test(message)
    ) {
      return {
        ok: false,
        error: "receipt_not_found",
        message: "Transaction receipt not found on Base yet.",
      };
    }

    return {
      ok: false,
      error: "rpc_error",
      message,
    };
  }
}
