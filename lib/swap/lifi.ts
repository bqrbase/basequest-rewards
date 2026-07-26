import {
  ChainId,
  convertQuoteToRoute,
  createClient,
  executeRoute,
  getQuote,
  type LiFiStep,
  type RouteExtended,
  type SDKClient,
} from "@lifi/sdk";
import { EthereumProvider } from "@lifi/sdk-provider-ethereum";
import type { Config } from "wagmi";
import { getWalletClient, switchChain } from "wagmi/actions";
import { base } from "viem/chains";

export const LIFI_BASE_CHAIN_ID = ChainId.BAS;

let quoteClient: SDKClient | null = null;

function getIntegrator(): string {
  // LI.FI requires alphanumeric (+ "-", "_", ".") and max 23 chars.
  const configured = process.env.NEXT_PUBLIC_LIFI_INTEGRATOR?.trim();
  if (configured && /^[A-Za-z0-9._-]{1,23}$/.test(configured)) {
    return configured;
  }
  return "basequest-rewards";
}

/** Lightweight client for quotes (no wallet provider required). */
export function getLifiQuoteClient(): SDKClient {
  if (!quoteClient) {
    quoteClient = createClient({
      integrator: getIntegrator(),
      apiKey: process.env.NEXT_PUBLIC_LIFI_API_KEY || undefined,
      // Auto-fetch LI.FI chain metadata (required for execution lookups).
      preloadChains: true,
      routeOptions: {
        allowSwitchChain: false,
      },
    });
  }
  return quoteClient;
}

/** Execution client wired to the current wagmi config (Base-focused). */
export function createLifiExecutionClient(wagmiConfig: Config): SDKClient {
  return createClient({
    integrator: getIntegrator(),
    apiKey: process.env.NEXT_PUBLIC_LIFI_API_KEY || undefined,
    // Must be true so getChainById(8453) can resolve Base during executeRoute.
    preloadChains: true,
    routeOptions: {
      allowSwitchChain: false,
    },
    providers: [
      EthereumProvider({
        async getWalletClient() {
          const client = await getWalletClient(wagmiConfig, {
            chainId: base.id,
          });
          if (!client) {
            throw new Error("Connect your wallet to swap.");
          }
          return client;
        },
        async switchChain(chainId) {
          const chain = await switchChain(wagmiConfig, { chainId });
          return getWalletClient(wagmiConfig, { chainId: chain.id });
        },
      }),
    ],
  });
}

/**
 * Execution client for cross-chain bridges (source chain → Base).
 * Allows wallet chain switches via the official LI.FI Ethereum provider.
 */
export function createLifiBridgeExecutionClient(
  wagmiConfig: Config,
): SDKClient {
  return createClient({
    integrator: getIntegrator(),
    apiKey: process.env.NEXT_PUBLIC_LIFI_API_KEY || undefined,
    preloadChains: true,
    routeOptions: {
      allowSwitchChain: true,
    },
    providers: [
      EthereumProvider({
        async getWalletClient() {
          const client = await getWalletClient(wagmiConfig);
          if (!client) {
            throw new Error("Connect your wallet to bridge.");
          }
          return client;
        },
        async switchChain(chainId) {
          const chain = await switchChain(wagmiConfig, { chainId });
          return getWalletClient(wagmiConfig, { chainId: chain.id });
        },
      }),
    ],
  });
}

/**
 * Ensure Base (8453) is present in the SDK chain registry.
 * Uses official LI.FI chain loading via getChains() when preloadChains is enabled.
 */
export async function ensureLifiBaseChain(
  client: SDKClient,
): Promise<void> {
  await client.getChainById(LIFI_BASE_CHAIN_ID);
}

/** Ensure a chain is present in the SDK registry (official preload / getChains). */
export async function ensureLifiChain(
  client: SDKClient,
  chainId: number,
): Promise<void> {
  await client.getChainById(chainId);
}

export type LifiQuoteRequest = {
  fromToken: string;
  toToken: string;
  fromAmount: string;
  fromAddress: string;
};

export async function fetchBaseSwapQuote(
  request: LifiQuoteRequest,
): Promise<LiFiStep> {
  return getQuote(getLifiQuoteClient(), {
    fromAddress: request.fromAddress,
    fromChain: LIFI_BASE_CHAIN_ID,
    toChain: LIFI_BASE_CHAIN_ID,
    fromToken: request.fromToken,
    toToken: request.toToken,
    fromAmount: request.fromAmount,
  });
}

export async function executeBaseSwapQuote(params: {
  wagmiConfig: Config;
  quote: LiFiStep;
  onUpdate?: (route: RouteExtended) => void;
}): Promise<RouteExtended> {
  const client = createLifiExecutionClient(params.wagmiConfig);
  // Warm the official chain registry before execution (loads Base via LI.FI API).
  await ensureLifiBaseChain(client);

  const route = convertQuoteToRoute(params.quote);

  return executeRoute(client, route, {
    updateRouteHook: params.onUpdate,
    acceptExchangeRateUpdateHook: async () => true,
  });
}

export type LifiBridgeQuoteRequest = {
  fromChain: number;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  fromAddress: string;
};

export async function fetchBridgeToBaseQuote(
  request: LifiBridgeQuoteRequest,
): Promise<LiFiStep> {
  return getQuote(getLifiQuoteClient(), {
    fromAddress: request.fromAddress,
    fromChain: request.fromChain,
    toChain: LIFI_BASE_CHAIN_ID,
    fromToken: request.fromToken,
    toToken: request.toToken,
    fromAmount: request.fromAmount,
  });
}

export async function executeBridgeToBaseQuote(params: {
  wagmiConfig: Config;
  quote: LiFiStep;
  fromChainId: number;
  onUpdate?: (route: RouteExtended) => void;
}): Promise<RouteExtended> {
  const client = createLifiBridgeExecutionClient(params.wagmiConfig);
  await ensureLifiChain(client, params.fromChainId);
  await ensureLifiBaseChain(client);

  const route = convertQuoteToRoute(params.quote);

  return executeRoute(client, route, {
    updateRouteHook: params.onUpdate,
    acceptExchangeRateUpdateHook: async () => true,
  });
}

export function getQuoteToAmount(quote: LiFiStep): string | null {
  return quote.estimate?.toAmount ?? null;
}

export function getQuoteToolLabel(quote: LiFiStep): {
  provider: string;
  label: string;
} {
  const name = quote.toolDetails?.name || quote.tool || "LI.FI";
  const key = quote.toolDetails?.key || quote.tool || "lifi";
  return {
    provider: name,
    label: `${name} · ${key}`,
  };
}

export function getQuoteGasUsd(quote: LiFiStep): number | null {
  const costs = quote.estimate?.gasCosts;
  if (!costs?.length) {
    return null;
  }

  const total = costs.reduce((sum, cost) => {
    const value = Number(cost.amountUSD);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);

  return Number.isFinite(total) ? total : null;
}

/** Gas + protocol fee estimate in USD (useful for bridges). */
export function getQuoteNetworkFeeUsd(quote: LiFiStep): number | null {
  const gasCosts = quote.estimate?.gasCosts ?? [];
  const feeCosts = quote.estimate?.feeCosts ?? [];
  const costs = [...gasCosts, ...feeCosts];
  if (!costs.length) {
    return null;
  }

  const total = costs.reduce((sum, cost) => {
    const value = Number(cost.amountUSD);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);

  return Number.isFinite(total) ? total : null;
}

/** Approximate price impact from LI.FI USD notionals. */
export function getQuotePriceImpactPercent(quote: LiFiStep): number | null {
  const fromUsd = Number(quote.estimate?.fromAmountUSD);
  const toUsd = Number(quote.estimate?.toAmountUSD);
  if (!Number.isFinite(fromUsd) || !Number.isFinite(toUsd) || fromUsd <= 0) {
    return null;
  }
  return ((fromUsd - toUsd) / fromUsd) * 100;
}

export function extractSwapTxHash(route: RouteExtended): string | null {
  for (const step of route.steps) {
    const actions = step.execution?.actions ?? [];
    for (let i = actions.length - 1; i >= 0; i -= 1) {
      const hash = actions[i]?.txHash;
      if (hash) {
        return hash;
      }
    }
  }
  return null;
}

/** First submitted tx hash (source-chain leg for bridges). */
export function extractFirstTxHash(route: RouteExtended): string | null {
  for (const step of route.steps) {
    for (const action of step.execution?.actions ?? []) {
      if (action.txHash) {
        return action.txHash;
      }
    }
  }
  return null;
}
