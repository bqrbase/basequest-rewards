import {
  type Abi,
  type Address,
  type Hash,
  type Hex,
  encodeDeployData,
  encodeFunctionData,
  numberToHex,
} from "viem";
import type { Config } from "wagmi";
import {
  deployContract,
  getAccount,
  waitForTransactionReceipt,
  writeContract,
} from "wagmi/actions";
import { ensureChain } from "@/lib/wallet/ChainManager";
import {
  RECEIPT_TIMEOUT_MS,
  SEND_CALLS_VERSIONS,
  WALLET_REQUIRED_CHAIN_ID,
} from "@/lib/wallet/constants";
import {
  WalletError,
  extractProviderRejection,
  isMethodUnsupportedError,
  isUserRejectedError,
  toWalletError,
} from "@/lib/wallet/Errors";
import { walletLogger } from "@/lib/wallet/logger";
import { resolveProviderSnapshot } from "@/lib/wallet/ProviderResolver";
import type { WalletHost } from "@/lib/wagmi";
import {
  getActiveConnector,
  getHostWalletRequestClient,
  getHostWalletClient,
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

  requireConnectedAddress(params.config);

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
  abi: Abi;
  bytecode: Hex;
  args?: readonly unknown[];
  dataSuffix?: Hex;
};

export type DeployWalletDiagnostics = {
  host: WalletHost;
  activeConnectorId: string | null;
  activeConnectorType: string | null;
  connectedAddress: Address | null;
  chainId: number;
  walletClientChainName: string | undefined;
  walletClientChainId: number | undefined;
  walletClientAccount: Address | undefined;
};

/** Temporary diagnostics for mini-app deploy failures (no secrets). */
export async function collectDeployWalletDiagnostics(params: {
  config: Config;
  host: WalletHost;
  chainId: number;
}): Promise<DeployWalletDiagnostics> {
  const account = getAccount(params.config);
  let walletClientChainName: string | undefined;
  let walletClientChainId: number | undefined;
  let walletClientAccount: Address | undefined;

  try {
    const walletClient = await getHostWalletClient({
      config: params.config,
      chainId: params.chainId,
    });
    walletClientChainName = walletClient.chain?.name;
    walletClientChainId = walletClient.chain?.id;
    walletClientAccount = walletClient.account?.address;
  } catch {
    // diagnostics only
  }

  return {
    host: params.host,
    activeConnectorId: account.connector?.id ?? null,
    activeConnectorType: account.connector?.type ?? null,
    connectedAddress: account.address ?? null,
    chainId: params.chainId,
    walletClientChainName,
    walletClientChainId,
    walletClientAccount,
  };
}

type FarcasterHostRpc = {
  ethProviderRequestV2?: (request: unknown) => Promise<unknown>;
  ethProviderRequest?: (request: unknown) => Promise<unknown>;
};

type HostRpcError = {
  code?: number;
  message?: string;
  details?: unknown;
  data?: unknown;
};

function inspectHexPayload(data: Hex) {
  const body = data.startsWith("0x") ? data.slice(2) : data;
  return {
    startsWith0x: data.startsWith("0x"),
    empty: body.length === 0,
    evenHex: body.length % 2 === 0,
    byteLength: Math.floor(body.length / 2),
    prefix: data.slice(0, 10),
  };
}

function snapshotSendTransaction(tx: Record<string, unknown>) {
  const data = typeof tx.data === "string" ? (tx.data as Hex) : undefined;
  return {
    method: "eth_sendTransaction",
    paramKeys: Object.keys(tx),
    from: tx.from ?? null,
    hasTo: Object.prototype.hasOwnProperty.call(tx, "to"),
    to: tx.to ?? null,
    hasValue: Object.prototype.hasOwnProperty.call(tx, "value"),
    value: tx.value ?? null,
    hasGas: Object.prototype.hasOwnProperty.call(tx, "gas"),
    hasGasLimit: Object.prototype.hasOwnProperty.call(tx, "gasLimit"),
    hasChainId: Object.prototype.hasOwnProperty.call(tx, "chainId"),
    data: data ? inspectHexPayload(data) : null,
  };
}

function formatHostRpcError(error: HostRpcError): string {
  const parts = [
    typeof error.code === "number" ? `code=${error.code}` : null,
    typeof error.message === "string" && error.message
      ? `message=${error.message}`
      : null,
    typeof error.details === "string" && error.details
      ? `details=${error.details}`
      : null,
  ].filter(Boolean);
  return parts.length > 0
    ? `Farcaster host rejected eth_sendTransaction (${parts.join(", ")})`
    : "Farcaster host rejected eth_sendTransaction with an empty error payload.";
}

/**
 * Farcaster deploy must hit MiniAppSDK.wallet.ethProvider (host → Rainbow).
 * Call ethProviderRequestV2 directly so we capture the host's { code, message, data }
 * before the SDK maps missing `details` to "Unknown provider RPC error".
 *
 * Match Daily Check-in fallback: { from, data } only — no chainId, gas, or
 * ERC-8021 suffix concatenated into CREATE initcode.
 */
async function deployContractViaMiniAppProvider(params: {
  config: Config;
  chainId: number;
  abi: Abi;
  bytecode: Hex;
  args?: readonly unknown[];
  dataSuffix?: Hex;
}): Promise<Hash> {
  const account = getAccount(params.config);
  const connector = getActiveConnector(params.config) ?? account.connector;
  const from = account.address ?? requireConnectedAddress(params.config);

  const bytecodeInfo = inspectHexPayload(params.bytecode);
  if (
    !bytecodeInfo.startsWith0x ||
    bytecodeInfo.empty ||
    !bytecodeInfo.evenHex
  ) {
    throw new WalletError(
      "TRANSACTION_FAILED",
      "HelloBase bytecode is not valid hex.",
    );
  }

  const data = encodeDeployData({
    abi: params.abi,
    bytecode: params.bytecode,
    args: params.args as never,
  });

  const tx = {
    from,
    data,
  };

  let providerType: string | null = null;
  try {
    const provider = (await connector?.getProvider({
      chainId: params.chainId,
    })) as { constructor?: { name?: string } } | undefined;
    providerType = provider?.constructor?.name ?? typeof provider;
  } catch {
    providerType = null;
  }

  walletLogger.error("farcaster-deploy-rpc", {
    activeConnectorId: connector?.id ?? null,
    activeConnectorType: connector?.type ?? null,
    connectedAddress: account.address ?? null,
    chainId: params.chainId,
    providerType,
    constructorArgs: params.args?.length ?? 0,
    dataSuffixOmitted: true,
    dataSuffixBytes: params.dataSuffix
      ? inspectHexPayload(params.dataSuffix).byteLength
      : 0,
    bytecode: bytecodeInfo,
    encodedEqualsBytecode: data === params.bytecode,
    request: snapshotSendTransaction(tx),
  });

  const jsonRpcRequest = {
    jsonrpc: "2.0" as const,
    id: Date.now(),
    method: "eth_sendTransaction",
    params: [tx],
  };

  const { miniAppHost } = (await import("@farcaster/miniapp-sdk")) as {
    miniAppHost?: FarcasterHostRpc;
  };
  const host = miniAppHost;

  if (host?.ethProviderRequestV2 || host?.ethProviderRequest) {
    let raw: unknown;
    try {
      raw = host.ethProviderRequestV2
        ? await host.ethProviderRequestV2(jsonRpcRequest)
        : await host.ethProviderRequest?.(jsonRpcRequest);
    } catch (error) {
      walletLogger.error("farcaster-host-rpc-throw", {
        rejection: extractProviderRejection(error),
      });
      const layers = extractProviderRejection(error).layers;
      const hostLayer = layers[0];
      throw new WalletError(
        "TRANSACTION_FAILED",
        formatHostRpcError({
          code: typeof hostLayer?.code === "number" ? hostLayer.code : undefined,
          message: hostLayer?.message,
          details: hostLayer?.details,
          data: hostLayer?.data,
        }),
        error,
      );
    }

    const response =
      raw && typeof raw === "object"
        ? (raw as { result?: unknown; error?: HostRpcError })
        : { result: raw };

    if (response.error) {
      walletLogger.error("farcaster-host-rpc-error", {
        code: response.error.code ?? null,
        message: response.error.message ?? null,
        details: response.error.details ?? null,
        data: response.error.data ?? null,
        keys: Object.keys(response.error),
      });
      throw new WalletError(
        "TRANSACTION_FAILED",
        formatHostRpcError(response.error),
        response.error,
      );
    }

    if (typeof response.result !== "string" || !response.result.startsWith("0x")) {
      throw new WalletError(
        "TRANSACTION_FAILED",
        "Farcaster host did not return a transaction hash.",
        response,
      );
    }

    return response.result as Hash;
  }

  const provider = (await connector?.getProvider({
    chainId: params.chainId,
  })) as
    | {
        request: (args: {
          method: string;
          params?: readonly unknown[];
        }) => Promise<unknown>;
      }
    | undefined;

  if (!provider?.request) {
    throw new WalletError(
      "PROVIDER_UNAVAILABLE",
      "Farcaster wallet provider is unavailable. Reconnect and try again.",
    );
  }

  try {
    return (await provider.request({
      method: "eth_sendTransaction",
      params: [tx],
    })) as Hash;
  } catch (providerError) {
    walletLogger.error("farcaster-ethProvider-request-error", {
      rejection: extractProviderRejection(providerError),
    });
    const layers = extractProviderRejection(providerError).layers;
    const hostLayer = layers[0];
    throw new WalletError(
      "TRANSACTION_FAILED",
      formatHostRpcError({
        code: typeof hostLayer?.code === "number" ? hostLayer.code : undefined,
        message: hostLayer?.message,
        details: hostLayer?.details,
        data: hostLayer?.data,
      }),
      providerError,
    );
  }
}

export async function executeDeployContract(
  params: DeployContractParams,
): Promise<WalletTxResult & { contractAddress?: Address }> {
  requireConnectedAddress(params.config);

  const chainId = await ensureChain({
    config: params.config,
    chainId: params.chainId ?? WALLET_REQUIRED_CHAIN_ID,
  });

  walletLogger.debug(
    "deploy-diagnostics",
    await collectDeployWalletDiagnostics({
      config: params.config,
      host: params.host,
      chainId,
    }),
  );

  try {
    const hash =
      params.host === "farcaster"
        ? await deployContractViaMiniAppProvider({
            config: params.config,
            chainId,
            abi: params.abi,
            bytecode: params.bytecode,
            args: params.args,
            dataSuffix: params.dataSuffix,
          })
        : await deployContract(params.config, {
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
    if (receipt.status !== "success") {
      throw new WalletError(
        "TRANSACTION_FAILED",
        "Deployment transaction reverted.",
      );
    }
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
