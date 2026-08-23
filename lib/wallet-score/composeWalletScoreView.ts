import {
  formatTransactionCount,
  formatWalletAgeDays,
  getAvatarLabel,
} from "@/lib/wallet-score/formatters";
import { deriveAnalyticsDashboard } from "@/lib/wallet-score/analytics";
import type { WalletAnalytics } from "@/lib/wallet-score/analytics/types";
import { walletScoreHero, walletStats } from "@/lib/wallet-score/mock-data";
import { calculateWalletScore } from "@/lib/wallet-score/scoring";
import { analyzeWalletIntelligence } from "@/lib/wallet-score/intelligence";
import type {
  DataSource,
  EcosystemUsagePanel,
  LiveWalletBasics,
  WalletScoreViewModel,
} from "@/lib/wallet-score/types";

const LIVE_STAT_IDS = new Set([
  "age",
  "txs",
  "eth",
  "usdc",
  "active",
  "contracts",
  "tokens",
  "nfts",
]);

function buildEcosystemPanel(
  live: LiveWalletBasics,
  scoreResult: WalletScoreViewModel["score"],
): EcosystemUsagePanel {
  const breakdown = scoreResult.breakdown.find(
    (row) => row.id === "baseEcosystemUsage",
  );
  const scorePoints = Math.round(breakdown?.weightedPoints ?? 0);
  const scorePointsMax = Math.round(
    (breakdown?.weight ?? 0.1) * scoreResult.maxScore,
  );
  const categoryScore = breakdown?.categoryScore ?? live.ecosystemScore ?? 0;

  const hasLive =
    live.isConnected &&
    !live.isLoading &&
    live.protocolsUsed !== null &&
    live.protocolInteractions !== null;

  if (hasLive) {
    const totalInteractions = Math.max(live.protocolInteractions ?? 0, 1);
    const protocols = live.ecosystemProtocols.map((protocol) => ({
      id: protocol.id,
      name: protocol.name,
      interactions: protocol.interactions,
      share:
        live.protocolInteractions && live.protocolInteractions > 0
          ? Math.round((protocol.interactions / totalInteractions) * 100)
          : 0,
    }));

    return {
      source: "live",
      protocolsUsed: live.protocolsUsed ?? protocols.length,
      contractInteractions: live.protocolInteractions ?? 0,
      ecosystemScore: categoryScore,
      scorePoints,
      scorePointsMax,
      protocols,
    };
  }

  return {
    source: live.isConnected ? "unavailable" : "unavailable",
    protocolsUsed: 0,
    contractInteractions: 0,
    ecosystemScore: categoryScore,
    scorePoints,
    scorePointsMax,
    protocols: [],
  };
}

/**
 * Compose the Wallet Score page from live connection state + unified analytics.
 * Scoring engine unchanged; UI sections use derived analytics only (no mock widgets).
 */
export function composeWalletScoreView(
  live: LiveWalletBasics,
  analytics: WalletAnalytics | null = null,
): WalletScoreViewModel {
  const addressSource: DataSource = live.address ? "live" : "unavailable";
  const basenameSource: DataSource = live.basename
    ? "live"
    : live.address
      ? "unavailable"
      : "unavailable";

  const useLiveMetrics = live.isConnected && !live.isLoading;
  const scoreResult = calculateWalletScore(
    useLiveMetrics
      ? {
          walletAgeDays: live.walletAgeDays,
          transactionCount: live.transactionCount,
          activeDays: live.activeDays,
          contractInteractions: live.contractInteractions,
          uniqueTokens: live.uniqueTokens,
          nftCount: live.nftCount,
          protocolCount: live.protocolsUsed,
          protocolInteractions: live.protocolInteractions,
        }
      : {
          // Disconnected or still loading: never score mock dashboard metrics in the UI.
          walletAgeDays: 0,
          transactionCount: 0,
          activeDays: 0,
          contractInteractions: 0,
          uniqueTokens: 0,
          nftCount: 0,
          protocolCount: 0,
          protocolInteractions: 0,
        },
  );

  const stats: WalletScoreViewModel["stats"] = walletStats.map((stat) => {
    if (!LIVE_STAT_IDS.has(stat.id)) {
      return { ...stat, source: "unavailable" as const, value: "—" };
    }

    if (!live.isConnected) {
      return {
        ...stat,
        value: "—",
        hint: "Connect wallet",
        source: "unavailable" as const,
      };
    }

    if (live.isLoading) {
      return {
        ...stat,
        value: "…",
        hint: "Loading on-chain data",
        source: "live" as const,
      };
    }

    if (stat.id === "age") {
      return {
        ...stat,
        value: formatWalletAgeDays(live.walletAgeDays) ?? "—",
        hint: live.firstSeenAt
          ? `Since ${new Date(live.firstSeenAt).toLocaleDateString()}`
          : live.errors.history || "Since first Base tx",
        source: (live.walletAgeDays !== null
          ? "live"
          : "unavailable") as DataSource,
      };
    }

    if (stat.id === "txs") {
      return {
        ...stat,
        value: formatTransactionCount(live.transactionCount) ?? "—",
        hint: "Outbound txs on Base",
        source: (live.transactionCount !== null
          ? "live"
          : "unavailable") as DataSource,
      };
    }

    if (stat.id === "eth") {
      return {
        ...stat,
        value: live.ethBalance ?? "—",
        hint: "On-chain ETH balance",
        source: (live.ethBalance !== null ? "live" : "unavailable") as DataSource,
      };
    }

    if (stat.id === "usdc") {
      return {
        ...stat,
        value: live.usdcBalance ?? "—",
        hint: "Native USDC on Base",
        source: (live.usdcBalance !== null
          ? "live"
          : "unavailable") as DataSource,
      };
    }

    if (stat.id === "active") {
      return {
        ...stat,
        value:
          live.activeDays !== null ? live.activeDays.toLocaleString() : "—",
        hint: "Last 12 months",
        source: (live.activeDays !== null ? "live" : "unavailable") as DataSource,
      };
    }

    if (stat.id === "contracts") {
      return {
        ...stat,
        value:
          live.contractInteractions !== null
            ? live.contractInteractions.toLocaleString()
            : "—",
        hint: "Unique interacted",
        source: (live.contractInteractions !== null
          ? "live"
          : "unavailable") as DataSource,
      };
    }

    if (stat.id === "tokens") {
      return {
        ...stat,
        value:
          live.uniqueTokens !== null ? live.uniqueTokens.toLocaleString() : "—",
        hint: "Non-dust holdings",
        source: (live.uniqueTokens !== null
          ? "live"
          : "unavailable") as DataSource,
      };
    }

    if (stat.id === "nfts") {
      return {
        ...stat,
        value: live.nftCount !== null ? live.nftCount.toLocaleString() : "—",
        hint:
          live.nftCollectionCount !== null
            ? `Across ${live.nftCollectionCount} collections`
            : "On Base",
        source: (live.nftCount !== null ? "live" : "unavailable") as DataSource,
      };
    }

    return { ...stat, source: "unavailable" as const, value: "—" };
  });

  const intelligence = analyzeWalletIntelligence(scoreResult);

  return {
    live,
    hero: {
      title: walletScoreHero.title,
      score: scoreResult.score,
      maxScore: scoreResult.maxScore,
      rank: "—",
      percentile: useLiveMetrics
        ? intelligence.reputation.scoreBand
        : "—",
      walletAddress: live.address ?? "—",
      basename: live.basename,
      avatarLabel: live.address ? getAvatarLabel(live.address) : "BQ",
      tier: useLiveMetrics ? intelligence.reputation.label : "—",
      addressSource,
      basenameSource,
    },
    score: scoreResult,
    ecosystem: buildEcosystemPanel(live, scoreResult),
    intelligence,
    analytics: deriveAnalyticsDashboard(analytics, scoreResult),
    stats,
  };
}
