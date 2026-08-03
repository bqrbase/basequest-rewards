import type { Address } from "viem";
import type { Config, Connector } from "wagmi";
import { getAccount } from "wagmi/actions";
import {
  CAPABILITY_CACHE_TTL_MS,
  DEFAULT_CAPABILITIES,
} from "@/lib/wallet/constants";
import { walletLogger } from "@/lib/wallet/logger";
import type {
  ProviderSnapshot,
  WalletCapabilities,
  WalletHost,
  WalletRequestClient,
  WalletType,
} from "@/lib/wallet/types";

type CacheEntry = {
  expiresAt: number;
  capabilities: WalletCapabilities;
};

const capabilityCache = new Map<string, CacheEntry>();

function walletTypeFromConnector(connector: Connector | undefined): WalletType {
  if (!connector) {
    return "unknown";
  }
  if (
    connector.id === "farcaster" ||
    connector.type === "farcasterMiniApp" ||
    connector.type === "farcasterFrame"
  ) {
    return "farcaster";
  }
  if (connector.id === "baseAccount" || connector.type === "baseAccount") {
    return "baseAccount";
  }
  if (
    connector.id === "coinbaseWalletSDK" ||
    connector.id === "coinbaseWallet" ||
    connector.type === "coinbaseWallet"
  ) {
    return "coinbase";
  }
  if (connector.id === "walletConnect" || connector.type === "walletConnect") {
    return "walletConnect";
  }
  if (connector.id === "injected" || connector.type === "injected") {
    return "injected";
  }
  return "unknown";
}

function cacheKey(
  connectorId: string | null,
  address: Address | null,
): string {
  return `${connectorId ?? "none"}:${address ?? "none"}`;
}

async function probeMethod(
  client: WalletRequestClient,
  method: string,
  params: readonly unknown[] = [],
): Promise<boolean> {
  try {
    await client.request({ method, params });
    return true;
  } catch (error) {
    const message = (
      error instanceof Error ? error.message : String(error)
    ).toLowerCase();
    if (
      message.includes("does not support") ||
      message.includes("not supported") ||
      message.includes("unsupported") ||
      message.includes("method not found") ||
      message.includes("unknown method")
    ) {
      return false;
    }
    // User reject / invalid params still implies method exists.
    return true;
  }
}

export async function detectCapabilities(
  client: WalletRequestClient,
  options?: { force?: boolean; connectorId?: string | null; address?: Address | null },
): Promise<WalletCapabilities> {
  const key = cacheKey(
    options?.connectorId ?? null,
    options?.address ?? client.account?.address ?? null,
  );
  const cached = capabilityCache.get(key);
  if (!options?.force && cached && cached.expiresAt > Date.now()) {
    return cached.capabilities;
  }

  // Prefer wallet_getCapabilities when available; otherwise probe carefully.
  let walletSendCalls = false;
  let walletGetCallsStatus = false;
  let eip5792 = false;
  let smartWallet = false;

  try {
    const caps = (await client.request({
      method: "wallet_getCapabilities",
      params: client.account?.address ? [client.account.address] : [],
    })) as Record<string, unknown> | undefined;

    if (caps && typeof caps === "object") {
      const values = Object.values(caps);
      for (const value of values) {
        if (!value || typeof value !== "object") continue;
        const entry = value as Record<string, unknown>;
        if (entry.atomicBatch || entry.atomic) {
          walletSendCalls = true;
          eip5792 = true;
        }
        if (entry.paymasterService || entry.auxiliaryFunds) {
          smartWallet = true;
        }
      }
    }
  } catch {
    // fall through to probes
  }

  if (!walletSendCalls) {
    // Safe probe: empty/invalid calls should fail with invalid params if supported,
    // or method-not-found if unsupported.
    walletSendCalls = await probeMethod(client, "wallet_sendCalls", [
      {
        version: "2.0.0",
        chainId: "0x2105",
        from: client.account?.address,
        atomicRequired: false,
        calls: [],
      },
    ]);
    eip5792 = walletSendCalls;
  }

  if (walletSendCalls) {
    walletGetCallsStatus = await probeMethod(client, "wallet_getCallsStatus", [
      "0x",
    ]);
  }

  const capabilities: WalletCapabilities = {
    ...DEFAULT_CAPABILITIES,
    walletSendCalls,
    walletGetCallsStatus,
    eip5792,
    smartWallet,
    // Assume eth_sendTransaction exists; wallets without it fail at send time
    // with METHOD_UNSUPPORTED and are handled by TransactionManager fallbacks.
    ethSendTransaction: true,
  };

  capabilityCache.set(key, {
    capabilities,
    expiresAt: Date.now() + CAPABILITY_CACHE_TTL_MS,
  });

  walletLogger.debug("capabilities", { key, capabilities });
  return capabilities;
}

export function clearCapabilityCache(): void {
  capabilityCache.clear();
}

export async function resolveProviderSnapshot(params: {
  config: Config;
  host: WalletHost;
  client: WalletRequestClient;
}): Promise<ProviderSnapshot> {
  const account = getAccount(params.config);
  const connector = account.connector;
  const address =
    (params.client.account?.address as Address | undefined) ??
    account.address ??
    null;

  const capabilities = await detectCapabilities(params.client, {
    connectorId: connector?.id ?? null,
    address,
  });

  return {
    host: params.host,
    walletType: walletTypeFromConnector(connector),
    connectorId: connector?.id ?? null,
    connectorType: connector?.type ?? null,
    address,
    chainId: account.chainId ?? null,
    capabilities,
  };
}
