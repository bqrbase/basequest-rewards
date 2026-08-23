import type { WalletAnalytics } from "@/lib/wallet-score/analytics/types";
import {
  fetchNativeBalances,
  filterCountableTokens,
} from "@/lib/wallet-score/analytics/fetchNativeBalances";
import { fetchRecentTransactions } from "@/lib/wallet-score/analytics/fetchRecentTransactions";
import {
  CACHE_TTL_MS,
  getOrSetCached,
  peekCached,
} from "@/lib/wallet-score/cache";
import { analyzeBaseEcosystem } from "@/lib/wallet-score/ecosystem";
import {
  dominantFailureKind,
  userMessageForFailure,
} from "@/lib/wallet-score/errors";
import { fetchWalletActivity } from "@/lib/wallet-score/onchain/fetchWalletActivity";
import { fetchWalletHistory } from "@/lib/wallet-score/onchain/fetchWalletHistory";
import { fetchBlockscoutErc20Holdings } from "@/lib/wallet-score/onchain/fetchBlockscoutTokens";
import { fetchAlchemyErc20Holdings } from "@/lib/wallet-score/onchain/fetchAlchemyTokens";
import { fetchNftActivity } from "@/lib/wallet-score/onchain/fetchNftActivity";
import { countFilteredTokens } from "@/lib/wallet-score/onchain/tokenFilters";
import type { Address } from "viem";

function settledError(result: PromiseSettledResult<unknown>): string | undefined {
  if (result.status === "rejected") {
    return result.reason instanceof Error
      ? result.reason.message
      : "Request failed";
  }
  return undefined;
}

function emptyMetrics(): WalletAnalytics["metrics"] {
  return {
    walletAgeDays: null,
    transactionCount: null,
    activeDays: null,
    contractInteractions: null,
    uniqueTokens: null,
    nftCount: null,
    nftCollectionCount: null,
    protocolsUsed: null,
    protocolInteractions: null,
    ecosystemScore: null,
  };
}

export function createUnavailableAnalytics(
  address: Address,
  message: string,
  fromCache = false,
): WalletAnalytics {
  return {
    address,
    source: "unavailable",
    fetchedAt: new Date().toISOString(),
    firstSeenAt: null,
    ethBalance: null,
    ethUsd: null,
    usdcBalance: null,
    tokens: [],
    nftItems: [],
    transactions: [],
    protocols: [],
    metrics: emptyMetrics(),
    health: "unavailable",
    statusMessage: message,
    fromCache,
    errors: { activity: message },
  };
}

function isEmptyWallet(analytics: Omit<WalletAnalytics, "health" | "statusMessage" | "fromCache">): boolean {
  const noHistory =
    analytics.errors.history?.toLowerCase().includes("no transactions") ??
    false;
  const noActivity =
    (analytics.metrics.activeDays === null ||
      analytics.metrics.activeDays === 0) &&
    analytics.transactions.length === 0;
  const noAssets =
    analytics.tokens.length === 0 &&
    (analytics.metrics.nftCount === null || analytics.metrics.nftCount === 0);

  return (
    (noHistory || (analytics.firstSeenAt === null && noActivity)) &&
    noAssets &&
    analytics.protocols.length === 0
  );
}

function attachHealth(
  analytics: Omit<WalletAnalytics, "health" | "statusMessage" | "fromCache">,
  fromCache: boolean,
): WalletAnalytics {
  const errorMessages = Object.values(analytics.errors);
  const hasErrors = errorMessages.some(Boolean);
  const kind = dominantFailureKind(errorMessages);

  if (analytics.source === "unavailable" && isEmptyWallet(analytics)) {
    return {
      ...analytics,
      health: "empty",
      statusMessage: userMessageForFailure("empty"),
      fromCache,
    };
  }

  if (analytics.source === "unavailable") {
    return {
      ...analytics,
      health: "unavailable",
      statusMessage: userMessageForFailure(kind ?? "unknown", { fromCache }),
      fromCache,
    };
  }

  if (hasErrors) {
    return {
      ...analytics,
      health: "degraded",
      statusMessage: userMessageForFailure(kind ?? "unknown", { fromCache }),
      fromCache,
    };
  }

  if (isEmptyWallet(analytics)) {
    return {
      ...analytics,
      health: "empty",
      statusMessage: userMessageForFailure("empty"),
      fromCache,
    };
  }

  return {
    ...analytics,
    health: "ok",
    statusMessage: fromCache
      ? "Showing recently saved wallet data while providers refresh."
      : null,
    fromCache,
  };
}

async function loadWalletAnalytics(
  address: Address,
): Promise<WalletAnalytics> {
  const errors: WalletAnalytics["errors"] = {};

  const [
    historyResult,
    activityResult,
    tokensResult,
    nftActivityResult,
    ecosystemResult,
    txsResult,
  ] = await Promise.allSettled([
    fetchWalletHistory(address),
    fetchWalletActivity(address),
    fetchBlockscoutErc20Holdings(address).catch(async (error) => {
      try {
        return await fetchAlchemyErc20Holdings(address);
      } catch {
        throw error;
      }
    }),
    fetchNftActivity(address),
    analyzeBaseEcosystem({ address }),
    fetchRecentTransactions(address),
  ]);

  const history =
    historyResult.status === "fulfilled" ? historyResult.value : null;
  const activity =
    activityResult.status === "fulfilled" ? activityResult.value : null;
  let tokens =
    tokensResult.status === "fulfilled" ? tokensResult.value : [];
  const nftActivity =
    nftActivityResult.status === "fulfilled" ? nftActivityResult.value : null;
  const ecosystem =
    ecosystemResult.status === "fulfilled" ? ecosystemResult.value : null;
  const transactions =
    txsResult.status === "fulfilled" ? txsResult.value : [];

  if (historyResult.status === "rejected" || history?.source === "unavailable") {
    errors.history =
      settledError(historyResult) || history?.error || "History unavailable";
  }
  if (activityResult.status === "rejected" || activity?.source === "unavailable") {
    errors.activity =
      settledError(activityResult) || activity?.error || "Activity unavailable";
  }
  if (tokensResult.status === "rejected") {
    errors.tokens = settledError(tokensResult) || "Tokens unavailable";
    tokens = [];
  }
  if (
    nftActivityResult.status === "rejected" ||
    nftActivity?.source === "unavailable"
  ) {
    errors.nfts =
      settledError(nftActivityResult) || nftActivity?.error || "NFTs unavailable";
  }
  if (
    ecosystemResult.status === "rejected" ||
    ecosystem?.source === "unavailable"
  ) {
    errors.ecosystem =
      settledError(ecosystemResult) ||
      ecosystem?.error ||
      "Ecosystem unavailable";
  }
  if (txsResult.status === "rejected") {
    errors.transactions = settledError(txsResult) || "Transactions unavailable";
  }

  tokens = filterCountableTokens(tokens);
  const tokenStats = countFilteredTokens(tokens);

  let ethBalance: string | null = null;
  let ethUsd: number | null = null;
  let usdcBalance: string | null = null;
  try {
    const balances = await fetchNativeBalances(address, tokens);
    ethBalance = balances.ethBalance;
    ethUsd = balances.ethUsd;
    usdcBalance = balances.usdcBalance;
  } catch (error) {
    errors.balances =
      error instanceof Error ? error.message : "Balances unavailable";
  }

  const liveBits = [
    history?.walletAgeDays !== null && history?.walletAgeDays !== undefined,
    activity?.activeDays !== null && activity?.activeDays !== undefined,
    tokens.length > 0 || tokensResult.status === "fulfilled",
    nftActivity?.nftCount !== null && nftActivity?.nftCount !== undefined,
    ecosystem?.source === "blockscout",
    transactions.length > 0 || txsResult.status === "fulfilled",
  ].filter(Boolean).length;

  return attachHealth(
    {
      address,
      source: liveBits > 0 ? "live" : "unavailable",
      fetchedAt: new Date().toISOString(),
      firstSeenAt: history?.firstSeenAt ?? null,
      ethBalance,
      ethUsd,
      usdcBalance,
      tokens,
      nftItems: [],
      transactions,
      protocols: ecosystem?.protocols ?? [],
      metrics: {
        walletAgeDays: history?.walletAgeDays ?? null,
        transactionCount: null,
        activeDays: activity?.activeDays ?? null,
        contractInteractions: activity?.contractInteractions ?? null,
        uniqueTokens: tokenStats.counted,
        nftCount: nftActivity?.nftCount ?? null,
        nftCollectionCount: nftActivity?.collectionCount ?? null,
        protocolsUsed: ecosystem?.protocolsUsed ?? null,
        protocolInteractions: ecosystem?.contractInteractions ?? null,
        ecosystemScore: ecosystem?.ecosystemScore ?? null,
      },
      errors,
    },
    false,
  );
}

/**
 * Unified Base wallet analytics layer.
 * Never throws — returns unavailable/empty payloads or stale cache on failure.
 */
export async function fetchWalletAnalytics(
  address: Address,
): Promise<WalletAnalytics> {
  const cacheKey = `wallet-analytics:${address.toLowerCase()}`;

  const prior = peekCached<WalletAnalytics>(cacheKey);

  try {
    const result = await getOrSetCached(
      cacheKey,
      CACHE_TTL_MS.walletAnalytics,
      () => loadWalletAnalytics(address),
      {
        shouldCache: (analytics) =>
          analytics.source === "live" || analytics.health === "empty",
        staleOnError: true,
      },
    );

    const servedStale = Boolean(
      prior &&
        !prior.fresh &&
        prior.value.fetchedAt === result.fetchedAt,
    );

    if (servedStale && result.health !== "empty") {
      return {
        ...result,
        fromCache: true,
        health: result.health === "ok" ? "degraded" : result.health,
        statusMessage:
          result.statusMessage ||
          userMessageForFailure("unknown", { fromCache: true }),
      };
    }

    return result;
  } catch {
    const stale = peekCached<WalletAnalytics>(cacheKey);
    if (stale) {
      return {
        ...stale.value,
        fromCache: true,
        health:
          stale.value.health === "ok" ? "degraded" : stale.value.health,
        statusMessage: userMessageForFailure("unknown", { fromCache: true }),
      };
    }

    return createUnavailableAnalytics(
      address,
      userMessageForFailure("server"),
    );
  }
}
