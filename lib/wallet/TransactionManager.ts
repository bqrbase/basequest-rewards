import {
  type Abi,
  type Address,
  type Hash,
  type Hex,
  encodeFunctionData,
  numberToHex,
} from "viem";
import type { Config } from "wagmi";
import {
  deployContract,
  waitForTransactionReceipt,
  writeContract,
} from "wagmi/actions";
import { requireAuthSession } from "@/lib/wallet/Authentication";
import { ensureChain } from "@/lib/wallet/ChainManager";
import {
  RECEIPT_TIMEOUT_MS,
  SEND_CALLS_VERSIONS,
  WALLET_REQUIRED_CHAIN_ID,
} from "@/lib/wallet/constants";
import {
  WalletError,
  isMethodUnsupportedError,
  isUserRejectedError,
  toWalletError,
} from "@/lib/wallet/Errors";
import { walletLogger } from "@/lib/wallet/logger";
import { resolveProviderSnapshot } from "@/lib/wallet/ProviderResolver";
import type { WalletHost } from "@/lib/wagmi";
import {
  getHostWalletRequestClient,
  requireConnectedAddress,
} from "@/lib/wallet/WalletClient";
import type {
  SendCallsCapabilities,
  WalletCall,
  WalletRequestClient,
  WalletTxResult,
} from "@/lib/wallet/types";

function extractSendCallsId(result: unknown): string | null {
  if (typeof result === "string" && result.startsWith("0x")) {
    return result;
  }
  if (
    result &&
    typeof result === "object" &&
    "id" in result &&
    typeof (result as { id: unknown }).id === "string"
  ) {
    return (result as { id: string }).id;
  }
  return null;
}

function isTransactionHash(id: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(id);
}

function toHexValue(value: Hex | bigint | undefined): Hex {
  if (value === undefined) {
    return "0x0";
  }
  if (typeof value === "bigint") {
    return numberToHex(value);
  }
  return value;
}

async function waitForCallsSuccess(
  client: WalletRequestClient,
  callsId: string,
): Promise<Hash | null> {
  const deadline = Date.now() + RECEIPT_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const status = (await client.request({
      method: "wallet_getCallsStatus",
      params: [callsId],
    })) as {
      status?: number | string;
      receipts?: Array<{
        status?: Hex | string | number;
        transactionHash?: Hash;
      }>;
    };

    const code =
      typeof status?.status === "string"
        ? Number.parseInt(status.status, 10)
        : status?.status;

    const receipt = status?.receipts?.[0];
    const receiptStatus = receipt?.status;
    const receiptHash = receipt?.transactionHash ?? null;

    if (code === 200) {
      return receiptHash;
    }
    if (
      receiptStatus === "success" ||
      receiptStatus === "0x1" ||
      receiptStatus === 1
    ) {
      return receiptHash;
    }
    if (code !== undefined && code !== 100 && code >= 400) {
      throw new WalletError("TRANSACTION_FAILED", "Transaction failed.");
    }
    await new Promise((resolve) => setTimeout(resolve, 1_200));
  }

  throw new WalletError(
    "RECEIPT_TIMEOUT",
    "Timed out waiting for transaction confirmation.",
  );
}

async function trySendCalls(params: {
  client: WalletRequestClient;
  from: Address;
  chainId: number;
  calls: readonly WalletCall[];
  capabilities?: SendCallsCapabilities;
}): Promise<{ id: string } | { unsupported: true }> {
  const chainIdHex = numberToHex(params.chainId);
  const capabilityPasses: Array<SendCallsCapabilities | undefined> =
    params.capabilities ? [params.capabilities, undefined] : [undefined];

  let sawUnsupported = false;
  let lastError: unknown;

  for (const version of SEND_CALLS_VERSIONS) {
    for (const capabilities of capabilityPasses) {
      try {
        const result = await params.client.request({
          method: "wallet_sendCalls",
          params: [
            {
              version,
              chainId: chainIdHex,
              from: params.from,
              atomicRequired: false,
              calls: params.calls.map((call) => ({
                to: call.to,
                data: call.data ?? "0x",
                value: toHexValue(call.value),
              })),
              ...(capabilities ? { capabilities } : {}),
            },
          ],
        });
        const id = extractSendCallsId(result);
        if (!id) {
          throw new WalletError(
            "TRANSACTION_FAILED",
            "wallet_sendCalls did not return a batch id.",
          );
        }
        return { id };
      } catch (error) {
        lastError = error;
        if (isUserRejectedError(error)) {
          throw toWalletError(error);
        }
        if (isMethodUnsupportedError(error)) {
          sawUnsupported = true;
          continue;
        }
        const message = (
          error instanceof Error ? error.message : String(error)
        ).toLowerCase();
        if (
          message.includes("invalid params") ||
          message.includes("cannot parse") ||
          message.includes("capability") ||
          message.includes("atomic") ||
          message.includes("version")
        ) {
          // Strip viem footer false-positives for version
          const cleaned = message.replace(/version:\s*viem@[\d.]+/g, "");
          if (
            cleaned.includes("invalid params") ||
            cleaned.includes("cannot parse") ||
            cleaned.includes("capability") ||
            cleaned.includes("atomic") ||
            cleaned.includes("unsupported version") ||
            cleaned.includes("invalid version") ||
            cleaned.includes("version mismatch")
          ) {
            continue;
          }
        }
        throw toWalletError(error);
      }
    }
  }

  if (sawUnsupported || lastError) {
    return { unsupported: true };
  }
  throw toWalletError(lastError);
}

export type ExecuteCallsParams = {
  config: Config;
  host: WalletHost;
  calls: readonly WalletCall[];
  chainId?: number;
  requireAuth?: boolean;
  capabilities?: SendCallsCapabilities;
  /** Prefer sendCalls even if capability cache says false (will still fall back). */
  preferSendCalls?: boolean;
};

/**
 * Unified write engine for call batches (check-in, etc.).
 */
export async function executeCalls(
  params: ExecuteCallsParams,
): Promise<WalletTxResult> {
  if (params.calls.length === 0) {
    throw new WalletError("TRANSACTION_FAILED", "No calls to send.");
  }

  const address = requireConnectedAddress(params.config);
  if (params.requireAuth !== false) {
    await requireAuthSession({ config: params.config, address });
  }

  const chainId = await ensureChain({
    config: params.config,
    chainId: params.chainId ?? WALLET_REQUIRED_CHAIN_ID,
  });

  const client = await getHostWalletRequestClient({
    config: params.config,
    chainId,
  });
  const from = client.account?.address ?? address;

  const snapshot = await resolveProviderSnapshot({
    config: params.config,
    host: params.host,
    client,
  });

  walletLogger.debug("execute-calls", {
    host: params.host,
    connectorId: snapshot.connectorId,
    capabilities: snapshot.capabilities,
  });

  const preferSendCalls =
    params.preferSendCalls ?? snapshot.capabilities.walletSendCalls;

  if (preferSendCalls || params.preferSendCalls !== false) {
    const sendCallsResult = await trySendCalls({
      client,
      from,
      chainId,
      calls: params.calls,
      capabilities: params.capabilities,
    });

    if (!("unsupported" in sendCallsResult)) {
      const callsId = sendCallsResult.id;
      if (isTransactionHash(callsId)) {
        await waitForTransactionReceipt(params.config, {
          hash: callsId as Hash,
          chainId,
        });
        return { hash: callsId as Hash, callsId, method: "wallet_sendCalls" };
      }
      const hash = await waitForCallsSuccess(client, callsId);
      return { hash, callsId, method: "wallet_sendCalls" };
    }
  }

  if (params.calls.length !== 1) {
    throw new WalletError(
      "METHOD_UNSUPPORTED",
      "This wallet does not support batched calls.",
    );
  }

  const call = params.calls[0];
  // Omit chainId from eth_sendTransaction — Mini App providers often reject it.
  try {
    const hash = (await client.request({
      method: "eth_sendTransaction",
      params: [
        {
          from,
          to: call.to,
          data: call.data ?? "0x",
          ...(call.value && toHexValue(call.value) !== "0x0"
            ? { value: toHexValue(call.value) }
            : {}),
        },
      ],
    })) as Hash;

    await waitForTransactionReceipt(params.config, { hash, chainId });
    return { hash, callsId: null, method: "eth_sendTransaction" };
  } catch (error) {
    throw toWalletError(error);
  }
}

export type WriteContractParams = {
  config: Config;
  host: WalletHost;
  chainId?: number;
  requireAuth?: boolean;
  abi: Abi;
  address: Address;
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
  dataSuffix?: Hex;
  account?: Address;
};

export async function executeWriteContract(
  params: WriteContractParams,
): Promise<WalletTxResult> {
  const data = encodeFunctionData({
    abi: params.abi,
    functionName: params.functionName,
    args: params.args as never,
  });

  const capabilities: SendCallsCapabilities | undefined = params.dataSuffix
    ? {
        dataSuffix: {
          value: params.dataSuffix,
          optional: true,
        },
      }
    : undefined;

  // Prefer EIP-5792 / eth_sendTransaction path (host-safe), then wagmi writeContract.
  try {
    return await executeCalls({
      config: params.config,
      host: params.host,
      chainId: params.chainId,
      requireAuth: params.requireAuth,
      preferSendCalls: true,
      calls: [
        {
          to: params.address,
          data,
          value: params.value,
        },
      ],
      capabilities,
    });
  } catch (sendError) {
    if (isUserRejectedError(sendError)) {
      throw toWalletError(sendError);
    }

    walletLogger.debug("writeContract-fallback", {
      reason:
        sendError instanceof Error ? sendError.message : String(sendError),
    });
  }

  const address = requireConnectedAddress(params.config);
  if (params.requireAuth !== false) {
    await requireAuthSession({ config: params.config, address });
  }

  const chainId = await ensureChain({
    config: params.config,
    chainId: params.chainId ?? WALLET_REQUIRED_CHAIN_ID,
  });

  try {
    const hash = await writeContract(params.config, {
      abi: params.abi,
      address: params.address,
      functionName: params.functionName,
      args: params.args as never,
      chainId,
      account: params.account,
      value: params.value,
      ...(params.dataSuffix ? { dataSuffix: params.dataSuffix } : {}),
    });
    await waitForTransactionReceipt(params.config, {
      hash,
      confirmations: 1,
      chainId,
    });
    return { hash, callsId: null, method: "writeContract" };
  } catch (error) {
    throw toWalletError(error);
  }
}

export type DeployContractParams = {
  config: Config;
  host: WalletHost;
  chainId?: number;
  requireAuth?: boolean;
  abi: Abi;
  bytecode: Hex;
  args?: readonly unknown[];
  dataSuffix?: Hex;
};

export async function executeDeployContract(
  params: DeployContractParams,
): Promise<WalletTxResult & { contractAddress?: Address }> {
  const address = requireConnectedAddress(params.config);
  if (params.requireAuth !== false) {
    await requireAuthSession({ config: params.config, address });
  }

  const chainId = await ensureChain({
    config: params.config,
    chainId: params.chainId ?? WALLET_REQUIRED_CHAIN_ID,
  });

  try {
    const hash = await deployContract(params.config, {
      abi: params.abi,
      bytecode: params.bytecode,
      args: params.args as never,
      chainId,
      ...(params.dataSuffix ? { dataSuffix: params.dataSuffix } : {}),
    });
    const receipt = await waitForTransactionReceipt(params.config, {
      hash,
      confirmations: 1,
      chainId,
    });
    return {
      hash,
      callsId: null,
      method: "deployContract",
      contractAddress: receipt.contractAddress ?? undefined,
    };
  } catch (error) {
    throw toWalletError(error);
  }
}
