import type { QuestId } from "@/lib/quest-engine";
import type { EcosystemProtocolHit } from "@/lib/wallet-score/ecosystem/types";
import type { ActivityItem } from "@/lib/wallet-score/mock-data";
import type { WalletScoreViewModel } from "@/lib/wallet-score/types";

const SWAP_PROTOCOL_IDS = new Set(["uniswap", "aerodrome", "1inch"]);
const BRIDGE_PROTOCOL_IDS = new Set(["base-bridge"]);
const DEFI_PROTOCOL_IDS = new Set([
  "uniswap",
  "aerodrome",
  "1inch",
  "aave",
  "moonwell",
  "compound",
]);

export type ProfileActivityMetrics = {
  totalSwaps: number | null;
  totalBridges: number | null;
  protocolsUsed: number | null;
  nftsOwned: number | null;
  defiActivity: number | null;
};

function sumProtocolInteractions(
  protocols: EcosystemProtocolHit[],
  ids: Set<string>,
): number {
  return protocols.reduce((sum, protocol) => {
    if (!ids.has(protocol.id)) {
      return sum;
    }
    return sum + Math.max(0, protocol.interactions);
  }, 0);
}

function countTimelineType(items: ActivityItem[], type: string): number {
  return items.filter(
    (item) => item.type.toLowerCase() === type.toLowerCase(),
  ).length;
}

/**
 * Derive profile activity counters from wallet-score view data + quest flags.
 * Presentation-only — does not alter wallet-score or quest engines.
 */
export function deriveProfileActivityMetrics(
  walletScore: WalletScoreViewModel | null,
  completedQuestIds: QuestId[],
): ProfileActivityMetrics {
  if (!walletScore || !walletScore.live.isConnected) {
    return {
      totalSwaps: null,
      totalBridges: null,
      protocolsUsed: null,
      nftsOwned: null,
      defiActivity: null,
    };
  }

  if (walletScore.live.isLoading && !walletScore.analytics.fromCache) {
    return {
      totalSwaps: null,
      totalBridges: null,
      protocolsUsed: null,
      nftsOwned: null,
      defiActivity: null,
    };
  }

  const protocols = walletScore.live.ecosystemProtocols;
  const timeline = walletScore.analytics.recentActivity;

  const swapFromProtocols = sumProtocolInteractions(protocols, SWAP_PROTOCOL_IDS);
  const bridgeFromProtocols = sumProtocolInteractions(
    protocols,
    BRIDGE_PROTOCOL_IDS,
  );
  const swapFromTimeline = countTimelineType(timeline, "Swap");
  const bridgeFromTimeline = countTimelineType(timeline, "Bridge");

  const questSwapBonus = completedQuestIds.includes("first-swap") ? 1 : 0;
  const questBridgeBonus = completedQuestIds.includes("bridge-to-base") ? 1 : 0;

  const totalSwaps = Math.max(swapFromProtocols, swapFromTimeline, questSwapBonus);
  const totalBridges = Math.max(
    bridgeFromProtocols,
    bridgeFromTimeline,
    questBridgeBonus,
  );

  const defiFromProtocols = sumProtocolInteractions(protocols, DEFI_PROTOCOL_IDS);
  const defiActivity =
    walletScore.live.protocolInteractions ??
    (defiFromProtocols > 0 ? defiFromProtocols : null);

  return {
    totalSwaps,
    totalBridges,
    protocolsUsed: walletScore.live.protocolsUsed,
    nftsOwned: walletScore.live.nftCount,
    defiActivity,
  };
}

export function formatMetricValue(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "—";
  }
  return value.toLocaleString();
}
