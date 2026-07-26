import {
  createPublicClient,
  http,
  isHash,
  type Hash,
  type TransactionReceipt,
} from "viem";
import { base } from "viem/chains";

export type VerifyBaseDestinationTxResult =
  | {
      ok: true;
      receipt: TransactionReceipt;
      txHash: Hash;
      chainId: typeof base.id;
    }
  | {
      ok: false;
      error:
        | "invalid_tx_hash"
        | "receipt_not_found"
        | "tx_reverted"
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
 * Confirm a destination (receiving-chain) transaction on Base.
 * Does not require tx.from === wallet — bridge relayers often submit the dest leg.
 */
export async function verifyBaseDestinationTx(params: {
  txHash: string;
}): Promise<VerifyBaseDestinationTxResult> {
  if (!isHash(params.txHash)) {
    return {
      ok: false,
      error: "invalid_tx_hash",
      message: "A valid destination transaction hash is required.",
    };
  }

  const txHash = params.txHash as Hash;

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
        message: "Destination transaction receipt not found on Base.",
      };
    }

    if (receipt.status !== "success") {
      return {
        ok: false,
        error: "tx_reverted",
        message: "Destination transaction reverted on Base.",
      };
    }

    return { ok: true, receipt, txHash, chainId: base.id };
  } catch (error) {
    return {
      ok: false,
      error: "rpc_error",
      message:
        error instanceof Error
          ? error.message
          : "Failed to verify destination transaction on Base.",
    };
  }
}
