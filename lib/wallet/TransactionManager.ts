import {
  type Abi,
  type Address,
  type Hash,
  type Hex,
  concat,
  encodeDeployData,
  encodeFunctionData,
  encodePacked,
  getContractAddress,
  keccak256,
  numberToHex,
} from "viem";
import type { Config } from "wagmi";
import {
  deployContract,
  getAccount,
  getBytecode,
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
  getErrorMessage,
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

/** Base preinstall Create2Deployer — Smart Wallet deploy must CALL this, not native CREATE. */
const BASE_CREATE2_DEPLOYER_ADDRESS =
  "0x13b0D85CcB8bf860b6b79AF3029fCA081AE9beF2" as const satisfies Address;

const CREATE2_DEPLOYER_ABI = [
  {
    type: "function",
    name: "deploy",
    stateMutability: "nonpayable",
    inputs: [
      { name: "value", type: "uint256" },
      { name: "salt", type: "bytes32" },
      { name: "code", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

const BASE_APP_HELLO_BASE_SALT_PREFIX = "basequest.hellobase.v1";

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

function formatHostRpcError(method: string, error: HostRpcError): string {
  const dataSummary =
    typeof error.data === "string"
      ? error.data.slice(0, 200)
      : error.data != null
        ? JSON.stringify(error.data).slice(0, 200)
        : null;
  const parts = [
    typeof error.code === "number" ? `code=${error.code}` : null,
    typeof error.message === "string" && error.message
      ? `message=${error.message}`
      : null,
    typeof error.details === "string" && error.details
      ? `details=${error.details}`
      : null,
    dataSummary ? `data=${dataSummary}` : null,
  ].filter(Boolean);
  return parts.length > 0
    ? `Farcaster host rejected ${method} (${parts.join(", ")})`
    : `Farcaster host rejected ${method} with an empty error payload.`;
}

function parseHexQuantity(value: unknown): bigint {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]+$/.test(value)) {
    throw new WalletError(
      "TRANSACTION_FAILED",
      "Farcaster host returned an invalid eth_estimateGas hex quantity.",
      value,
    );
  }
  return BigInt(value);
}

function applyGasMargin(estimatedGas: bigint): Hex {
  const withMargin = (estimatedGas * 120n) / 100n;
  if (withMargin <= 0n) {
    throw new WalletError(
      "TRANSACTION_FAILED",
      "Farcaster host returned a zero eth_estimateGas result.",
    );
  }
  return numberToHex(withMargin);
}

/** Internal Farcaster Wallet rejects eth_estimateGas with EIP-1193 4200. Rainbow does not. */
function isFarcasterInternalEstimateUnsupported(error: unknown): boolean {
  const message = getErrorMessage(error);
  const layers = extractProviderRejection(error).layers;
  const mentionsEstimateGas =
    /eth_estimateGas/i.test(message) ||
    layers.some(
      (layer) =>
        typeof layer.message === "string" &&
        /eth_estimateGas/i.test(layer.message),
    );
  if (!mentionsEstimateGas) {
    return false;
  }
  const has4200 =
    /code=4200/.test(message) ||
    layers.some((layer) => layer.code === 4200 || layer.code === "4200");
  return (
    has4200 ||
    isMethodUnsupportedError(error) ||
    /does not support the requested method/i.test(message)
  );
}

function requireTransactionHash(hash: unknown): Hash {
  if (typeof hash !== "string" || !hash.startsWith("0x")) {
    throw new WalletError(
      "TRANSACTION_FAILED",
      "Farcaster host did not return a transaction hash.",
      hash,
    );
  }
  return hash as Hash;
}

async function requestFarcasterHostRpc(params: {
  host: FarcasterHostRpc;
  method: string;
  rpcParams: readonly unknown[];
}): Promise<unknown> {
  const jsonRpcRequest = {
    jsonrpc: "2.0" as const,
    id: Date.now(),
    method: params.method,
    params: params.rpcParams,
  };

  let raw: unknown;
  try {
    raw = params.host.ethProviderRequestV2
      ? await params.host.ethProviderRequestV2(jsonRpcRequest)
      : await params.host.ethProviderRequest?.(jsonRpcRequest);
  } catch (error) {
    walletLogger.error("farcaster-host-rpc-throw", {
      method: params.method,
      rejection: extractProviderRejection(error),
    });
    const layers = extractProviderRejection(error).layers;
    const hostLayer = layers[0];
    throw new WalletError(
      "TRANSACTION_FAILED",
      formatHostRpcError(params.method, {
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
      method: params.method,
      code: response.error.code ?? null,
      message: response.error.message ?? null,
      details: response.error.details ?? null,
      data: response.error.data ?? null,
      keys: Object.keys(response.error),
    });
    throw new WalletError(
      "TRANSACTION_FAILED",
      formatHostRpcError(params.method, response.error),
      response.error,
    );
  }

  return response.result;
}

/**
 * Farcaster CREATE deploy:
 * - External Rainbow: same-host eth_estimateGas + 20% margin, then
 *   eth_sendTransaction({ from, data, gas }).
 * - Internal Farcaster Wallet: eth_sendTransaction({ from, data }) with no
 *   estimate (host rejects eth_estimateGas with 4200).
 * No `to`, chainId, value, nonce, or DATA_SUFFIX.
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

  const estimateTx = {
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
    estimateRequest: snapshotSendTransaction(estimateTx),
  });

  const { miniAppHost } = (await import("@farcaster/miniapp-sdk")) as {
    miniAppHost?: FarcasterHostRpc;
  };
  const host = miniAppHost;

  if (host?.ethProviderRequestV2 || host?.ethProviderRequest) {
    let estimatedRaw: unknown;
    try {
      estimatedRaw = await requestFarcasterHostRpc({
        host,
        method: "eth_estimateGas",
        rpcParams: [estimateTx],
      });
    } catch (error) {
      if (isFarcasterInternalEstimateUnsupported(error)) {
        walletLogger.error("farcaster-deploy-internal", {
          skippedEstimateGas: true,
          sendRequest: snapshotSendTransaction(estimateTx),
        });
        return requireTransactionHash(
          await requestFarcasterHostRpc({
            host,
            method: "eth_sendTransaction",
            rpcParams: [estimateTx],
          }),
        );
      }
      throw error;
    }
    const estimatedGas = parseHexQuantity(estimatedRaw);
    const gas = applyGasMargin(estimatedGas);
    const sendTx = {
      from,
      data,
      gas,
    };

    walletLogger.error("farcaster-deploy-gas", {
      estimatedGasHex:
        typeof estimatedRaw === "string" ? estimatedRaw : String(estimatedRaw),
      estimatedGasDecimal: estimatedGas.toString(),
      gasWithMarginHex: gas,
      gasWithMarginDecimal: BigInt(gas).toString(),
      marginPercent: 20,
      sendRequest: snapshotSendTransaction(sendTx),
    });

    const hash = await requestFarcasterHostRpc({
      host,
      method: "eth_sendTransaction",
      rpcParams: [sendTx],
    });

    if (typeof hash !== "string" || !hash.startsWith("0x")) {
      throw new WalletError(
        "TRANSACTION_FAILED",
        "Farcaster host did not return a transaction hash.",
        hash,
      );
    }

    return hash as Hash;
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
    let estimatedRaw: unknown;
    try {
      estimatedRaw = await provider.request({
        method: "eth_estimateGas",
        params: [estimateTx],
      });
    } catch (estimateError) {
      if (isFarcasterInternalEstimateUnsupported(estimateError)) {
        walletLogger.error("farcaster-deploy-internal", {
          skippedEstimateGas: true,
          sendRequest: snapshotSendTransaction(estimateTx),
        });
        return requireTransactionHash(
          await provider.request({
            method: "eth_sendTransaction",
            params: [estimateTx],
          }),
        );
      }
      throw estimateError;
    }
    const estimatedGas = parseHexQuantity(estimatedRaw);
    const gas = applyGasMargin(estimatedGas);
    const sendTx = {
      from,
      data,
      gas,
    };

    walletLogger.error("farcaster-deploy-gas", {
      estimatedGasHex:
        typeof estimatedRaw === "string" ? estimatedRaw : String(estimatedRaw),
      estimatedGasDecimal: estimatedGas.toString(),
      gasWithMarginHex: gas,
      gasWithMarginDecimal: BigInt(gas).toString(),
      marginPercent: 20,
      sendRequest: snapshotSendTransaction(sendTx),
    });

    const hash = await provider.request({
      method: "eth_sendTransaction",
      params: [sendTx],
    });
    if (typeof hash !== "string" || !hash.startsWith("0x")) {
      throw new WalletError(
        "TRANSACTION_FAILED",
        "Farcaster host did not return a transaction hash.",
        hash,
      );
    }
    return hash as Hash;
  } catch (providerError) {
    if (providerError instanceof WalletError) {
      throw providerError;
    }
    walletLogger.error("farcaster-ethProvider-request-error", {
      rejection: extractProviderRejection(providerError),
    });
    const layers = extractProviderRejection(providerError).layers;
    const hostLayer = layers[0];
    throw new WalletError(
      "TRANSACTION_FAILED",
      formatHostRpcError("eth_estimateGas or eth_sendTransaction", {
        code: typeof hostLayer?.code === "number" ? hostLayer.code : undefined,
        message: hostLayer?.message,
        details: hostLayer?.details,
        data: hostLayer?.data,
      }),
      providerError,
    );
  }
}

/**
 * Base App only: deploy via Create2Deployer CALL (Smart Wallet cannot native CREATE).
 * Predicts the CREATE2 address, sends deploy(value, salt, code), then verifies code.
 */
async function deployContractViaCreate2Deployer(params: {
  config: Config;
  chainId: number;
  abi: Abi;
  bytecode: Hex;
  args?: readonly unknown[];
  dataSuffix?: Hex;
}): Promise<{ hash: Hash; contractAddress: Address }> {
  const from = requireConnectedAddress(params.config);

  const deployData = encodeDeployData({
    abi: params.abi,
    bytecode: params.bytecode,
    args: params.args as never,
  });
  const code: Hex = params.dataSuffix
    ? concat([deployData, params.dataSuffix])
    : deployData;

  const salt = keccak256(
    encodePacked(
      ["string", "address", "bytes32"],
      [BASE_APP_HELLO_BASE_SALT_PREFIX, from, keccak256(code)],
    ),
  );

  const predictedAddress = getContractAddress({
    bytecode: code,
    from: BASE_CREATE2_DEPLOYER_ADDRESS,
    opcode: "CREATE2",
    salt,
  });

  walletLogger.error("baseapp-create2-deploy", {
    deployer: BASE_CREATE2_DEPLOYER_ADDRESS,
    from,
    salt,
    predictedAddress,
    codeBytes: inspectHexPayload(code).byteLength,
    dataSuffixBytes: params.dataSuffix
      ? inspectHexPayload(params.dataSuffix).byteLength
      : 0,
  });

  const existing = await getBytecode(params.config, {
    address: predictedAddress,
    chainId: params.chainId,
  });
  if (existing && existing !== "0x") {
    throw new WalletError(
      "TRANSACTION_FAILED",
      `A contract is already deployed at the predicted address (${predictedAddress}).`,
    );
  }

  const hash = await writeContract(params.config, {
    address: BASE_CREATE2_DEPLOYER_ADDRESS,
    abi: CREATE2_DEPLOYER_ABI,
    functionName: "deploy",
    args: [0n, salt, code],
    chainId: params.chainId,
    account: from,
  });

  const receipt = await waitForTransactionReceipt(params.config, {
    hash,
    confirmations: 1,
    chainId: params.chainId,
  });
  if (receipt.status !== "success") {
    throw new WalletError(
      "TRANSACTION_FAILED",
      "Create2Deployer deployment transaction reverted.",
    );
  }

  // Pin to receipt block; retry briefly if public RPC latest lag returns empty.
  const maxAttempts = 3;
  let deployedCode: Hex | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    deployedCode = await getBytecode(params.config, {
      address: predictedAddress,
      chainId: params.chainId,
      blockNumber: receipt.blockNumber,
    });
    if (deployedCode && deployedCode !== "0x") {
      break;
    }
    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
    }
  }
  if (!deployedCode || deployedCode === "0x") {
    throw new WalletError(
      "TRANSACTION_FAILED",
      `Deployment confirmed, but no code was found at the predicted CREATE2 address (${predictedAddress}).`,
    );
  }

  return { hash, contractAddress: predictedAddress };
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
    if (params.host === "baseApp") {
      const { hash, contractAddress } = await deployContractViaCreate2Deployer({
        config: params.config,
        chainId,
        abi: params.abi,
        bytecode: params.bytecode,
        args: params.args,
        dataSuffix: params.dataSuffix,
      });
      return {
        hash,
        callsId: null,
        method: "deployContract",
        contractAddress,
      };
    }

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
