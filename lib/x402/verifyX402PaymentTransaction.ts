import {
  createPublicClient,
  decodeFunctionData,
  getAddress,
  http,
  isAddress,
  isHash,
  parseAbi,
  type Address,
  type Hash,
  type Hex,
  type TransactionReceipt,
} from "viem";
import { base } from "viem/chains";
import { USDC_BASE_ADDRESS } from "@/lib/wallet-score/constants";
import { getX402PayToAddress } from "@/lib/x402/config";

const TRANSFER_WITH_AUTHORIZATION_ABI = parseAbi([
  "function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)",
]);

export type VerifyX402PaymentError =
  | "invalid_tx_hash"
  | "invalid_wallet"
  | "missing_pay_to"
  | "receipt_not_found"
  | "tx_reverted"
  | "contract_mismatch"
  | "function_mismatch"
  | "wallet_mismatch"
  | "payee_mismatch"
  | "rpc_error";

export type VerifyX402PaymentResult =
  | {
      ok: true;
      receipt: TransactionReceipt;
      txHash: Hash;
      payer: Address;
      payTo: Address;
    }
  | {
      ok: false;
      error: VerifyX402PaymentError;
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
 * Verify an x402 Exact USDC settle tx.
 * Facilitator submits the tx (tx.from ≠ payer); payer is authorization.from.
 */
export async function verifyX402PaymentTransaction(params: {
  txHash: string;
  walletAddress: string;
}): Promise<VerifyX402PaymentResult> {
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

  const payToConfigured = getX402PayToAddress();
  if (!payToConfigured) {
    return {
      ok: false,
      error: "missing_pay_to",
      message: "X402_PAY_TO is not configured.",
    };
  }

  const txHash = params.txHash as Hash;
  const claimedWallet = getAddress(params.walletAddress).toLowerCase();
  const expectedPayTo = getAddress(payToConfigured).toLowerCase();
  const usdc = getAddress(USDC_BASE_ADDRESS).toLowerCase();

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
    if (!tx?.to || getAddress(tx.to).toLowerCase() !== usdc) {
      return {
        ok: false,
        error: "contract_mismatch",
        message: "Transaction target is not Base USDC.",
      };
    }

    let from: Address;
    let to: Address;
    try {
      const decoded = decodeFunctionData({
        abi: TRANSFER_WITH_AUTHORIZATION_ABI,
        data: tx.input as Hex,
      });
      from = getAddress(decoded.args[0]);
      to = getAddress(decoded.args[1]);
    } catch {
      return {
        ok: false,
        error: "function_mismatch",
        message:
          "Transaction is not a USDC transferWithAuthorization settlement.",
      };
    }

    if (from.toLowerCase() !== claimedWallet) {
      return {
        ok: false,
        error: "wallet_mismatch",
        message: "Payment authorization payer does not match the connected wallet.",
      };
    }

    if (to.toLowerCase() !== expectedPayTo) {
      return {
        ok: false,
        error: "payee_mismatch",
        message: "Payment authorization recipient does not match X402_PAY_TO.",
      };
    }

    return {
      ok: true,
      receipt,
      txHash,
      payer: from,
      payTo: to,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to verify x402 payment transaction on Base.";
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

/** Retry helper for RPC lag after client-side settlement. */
export async function verifyX402PaymentTransactionWithRetry(
  params: Parameters<typeof verifyX402PaymentTransaction>[0],
): Promise<VerifyX402PaymentResult> {
  let last: VerifyX402PaymentResult | null = null;

  for (let attempt = 1; attempt <= VERIFY_ATTEMPTS; attempt++) {
    last = await verifyX402PaymentTransaction(params);
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
      message: "Failed to verify x402 payment transaction on Base.",
    }
  );
}
