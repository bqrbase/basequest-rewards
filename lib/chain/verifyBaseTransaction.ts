import {
  createPublicClient,
  getAddress,
  http,
  isAddress,
  isHash,
  slice,
  type Address,
  type Hash,
  type Hex,
  type TransactionReceipt,
} from "viem";
import { base } from "viem/chains";

export type VerifyBaseTransactionError =
  | "invalid_tx_hash"
  | "invalid_wallet"
  | "receipt_not_found"
  | "tx_reverted"
  | "wallet_mismatch"
  | "contract_mismatch"
  | "function_mismatch"
  | "rpc_error";

export type VerifyBaseTransactionResult =
  | {
      ok: true;
      receipt: TransactionReceipt;
      txHash: Hash;
      from: Address;
      to: Address | null;
      input: Hex;
    }
  | {
      ok: false;
      error: VerifyBaseTransactionError;
      message: string;
    };

function getBaseRpcUrl(): string {
  return (
    process.env.BASE_RPC_URL ||
    process.env.NEXT_PUBLIC_BASE_RPC_URL ||
    "https://mainnet.base.org"
  );
}

function createBasePublicClient() {
  return createPublicClient({
    chain: base,
    transport: http(getBaseRpcUrl()),
  });
}

/**
 * Server-side Base Mainnet transaction verification.
 * Never trusts the client beyond the submitted hash + claimed wallet.
 */
export async function verifyBaseTransaction(params: {
  txHash: string;
  walletAddress: string;
  /** When set, tx.to must match (contract call / create2 target). */
  expectedTo?: Address | string;
  /** 4-byte function selector, e.g. toFunctionSelector("checkIn()"). */
  expectedFunctionSelector?: Hex;
  /**
   * When true, allow contract-creation txs (to === null) if receipt.contractAddress is set.
   * expectedTo is ignored for creations.
   */
  allowContractCreation?: boolean;
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

  const txHash = params.txHash as Hash;
  const wallet = getAddress(params.walletAddress).toLowerCase();
  const expectedTo = params.expectedTo
    ? getAddress(params.expectedTo).toLowerCase()
    : null;
  const expectedSelector = params.expectedFunctionSelector
    ? params.expectedFunctionSelector.toLowerCase()
    : null;

  try {
    const client = createBasePublicClient();
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

    const tx = await client.getTransaction({ hash: txHash });
    if (!tx?.from || tx.from.toLowerCase() !== wallet) {
      return {
        ok: false,
        error: "wallet_mismatch",
        message: "Transaction sender does not match the connected wallet.",
      };
    }

    const to = tx.to ? getAddress(tx.to) : null;
    const input = (tx.input ?? "0x") as Hex;
    const isCreation = !to && Boolean(receipt.contractAddress);

    if (params.allowContractCreation && isCreation) {
      // Contract deploy: sender already matched; no to/selector checks.
    } else if (expectedTo) {
      if (!to || to.toLowerCase() !== expectedTo) {
        return {
          ok: false,
          error: "contract_mismatch",
          message: "Transaction target contract does not match the expected contract.",
        };
      }
    }

    if (expectedSelector && !isCreation) {
      if (input.length < 10) {
        return {
          ok: false,
          error: "function_mismatch",
          message: "Transaction calldata does not match the expected function.",
        };
      }
      const selector = slice(input, 0, 4).toLowerCase();
      if (selector !== expectedSelector) {
        return {
          ok: false,
          error: "function_mismatch",
          message: "Transaction calldata does not match the expected function.",
        };
      }
    }

    return {
      ok: true,
      receipt,
      txHash,
      from: getAddress(tx.from),
      to,
      input,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to verify transaction on Base.";
    const name =
      error && typeof error === "object" && "name" in error
        ? String((error as { name?: unknown }).name)
        : "";

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

const VERIFY_ATTEMPTS = 5;
const VERIFY_RETRY_MS = 800;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retry helper for RPC lag after client-side confirmation. */
export async function verifyBaseTransactionWithRetry(
  params: Parameters<typeof verifyBaseTransaction>[0],
): Promise<VerifyBaseTransactionResult> {
  let last: VerifyBaseTransactionResult | null = null;

  for (let attempt = 1; attempt <= VERIFY_ATTEMPTS; attempt++) {
    last = await verifyBaseTransaction(params);
    if (last.ok) {
      return last;
    }

    const retryable =
      last.error === "rpc_error" || last.error === "receipt_not_found";
    if (!retryable || attempt === VERIFY_ATTEMPTS) {
      return last;
    }

    await sleep(VERIFY_RETRY_MS * attempt);
  }

  return (
    last ?? {
      ok: false,
      error: "rpc_error",
      message: "Failed to verify transaction on Base.",
    }
  );
}
