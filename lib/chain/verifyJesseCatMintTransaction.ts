import {
  createPublicClient,
  erc721Abi,
  getAddress,
  http,
  isAddress,
  isHash,
  parseEventLogs,
  zeroAddress,
  type Hash,
} from "viem";
import { base } from "viem/chains";
import { JESSECAT_CONTRACT_ADDRESS } from "@/lib/jessecat/config";
import type {
  VerifyBaseTransactionError,
  VerifyBaseTransactionResult,
} from "@/lib/chain/verifyBaseTransaction";

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

const VERIFY_ATTEMPTS = 5;
const VERIFY_RETRY_MS = 800;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Confirm a JesseCat mint on Base: receipt success + ERC-721 Transfer
 * from the zero address to the claimed wallet on the official contract.
 * Does not require tx.from === wallet (bundler / smart-account mints).
 */
export async function verifyJesseCatMintTransaction(params: {
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

  const txHash = params.txHash as Hash;
  const wallet = getAddress(params.walletAddress).toLowerCase();
  const jessecat = getAddress(JESSECAT_CONTRACT_ADDRESS).toLowerCase();

  let lastError: VerifyBaseTransactionError = "rpc_error";
  let lastMessage = "Failed to verify JesseCat mint on Base.";

  for (let attempt = 1; attempt <= VERIFY_ATTEMPTS; attempt++) {
    try {
      const client = createBasePublicClient();
      const receipt = await client.getTransactionReceipt({ hash: txHash });

      if (!receipt) {
        lastError = "receipt_not_found";
        lastMessage = "Transaction receipt not found on Base yet.";
        if (attempt === VERIFY_ATTEMPTS) {
          break;
        }
        await sleep(VERIFY_RETRY_MS * attempt);
        continue;
      }

      if (receipt.status !== "success") {
        return {
          ok: false,
          error: "tx_reverted",
          message: "Transaction reverted on Base.",
        };
      }

      const transferLogs = parseEventLogs({
        abi: erc721Abi,
        eventName: "Transfer",
        logs: receipt.logs,
      });

      const mintedToWallet = transferLogs.some((log) => {
        const from = log.args.from;
        const to = log.args.to;
        return (
          log.address.toLowerCase() === jessecat &&
          typeof from === "string" &&
          from.toLowerCase() === zeroAddress &&
          typeof to === "string" &&
          to.toLowerCase() === wallet
        );
      });

      if (!mintedToWallet) {
        return {
          ok: false,
          error: "contract_mismatch",
          message:
            "Transaction is not a confirmed JesseCat mint to this wallet.",
        };
      }

      const tx = await client.getTransaction({ hash: txHash });
      return {
        ok: true,
        receipt,
        txHash,
        from: getAddress(params.walletAddress),
        to: tx?.to ? getAddress(tx.to) : null,
        input: (tx?.input ?? "0x") as `0x${string}`,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to verify JesseCat mint on Base.";
      const name =
        error && typeof error === "object" && "name" in error
          ? String((error as { name?: unknown }).name)
          : "";

      if (
        name.includes("TransactionReceiptNotFound") ||
        /receipt.*not found|could not be found/i.test(message)
      ) {
        lastError = "receipt_not_found";
        lastMessage = "Transaction receipt not found on Base yet.";
        if (attempt === VERIFY_ATTEMPTS) {
          break;
        }
        await sleep(VERIFY_RETRY_MS * attempt);
        continue;
      }

      lastError = "rpc_error";
      lastMessage = message;
      if (attempt === VERIFY_ATTEMPTS) {
        break;
      }
      await sleep(VERIFY_RETRY_MS * attempt);
    }
  }

  return {
    ok: false,
    error: lastError,
    message: lastMessage,
  };
}
