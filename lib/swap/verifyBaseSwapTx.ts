import {
  verifyBaseTransaction,
  type VerifyBaseTransactionResult,
} from "@/lib/chain/verifyBaseTransaction";
import type { Hash, TransactionReceipt } from "viem";

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

/**
 * Confirm a wallet-sent transaction on Base Mainnet (sender + success).
 * Façade over verifyBaseTransaction for existing swap/claim/deploy call sites.
 */
export async function verifyBaseSwapTx(params: {
  txHash: string;
  walletAddress: string;
}): Promise<VerifyBaseSwapTxResult> {
  const result = await verifyBaseTransaction(params);
  return mapResult(result);
}

function mapResult(result: VerifyBaseTransactionResult): VerifyBaseSwapTxResult {
  if (result.ok) {
    return {
      ok: true,
      receipt: result.receipt,
      txHash: result.txHash,
    };
  }

  if (
    result.error === "invalid_wallet" ||
    result.error === "contract_mismatch" ||
    result.error === "function_mismatch"
  ) {
    return {
      ok: false,
      error: "rpc_error",
      message: result.message,
    };
  }

  return {
    ok: false,
    error: result.error,
    message: result.message,
  };
}
