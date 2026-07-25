import type { Address } from "viem";

export type EcosystemProtocolHit = {
  id: string;
  name: string;
  interactions: number;
  contracts: string[];
};

/**
 * Result of Base ecosystem analysis for a wallet.
 * Feeds the existing scoring inputs: protocolCount / protocolInteractions.
 */
export type BaseEcosystemAnalysis = {
  /** Unique known Base protocols interacted with. */
  protocolsUsed: number;
  /** Outbound interactions with known ecosystem contracts. */
  contractInteractions: number;
  /** Unique known ecosystem contract addresses touched. */
  uniqueContracts: number;
  /**
   * Category contribution on a 0–100 scale, using the same curve
   * as the Base Ecosystem Usage weight in the scoring engine.
   */
  ecosystemScore: number;
  /** Per-protocol breakdown (address registry + Blockscout labels). */
  protocols: EcosystemProtocolHit[];
  /** How many recent txs were scanned for this signal. */
  transactionsScanned: number;
  source: "blockscout" | "unavailable";
  error?: string;
};

export type BaseEcosystemAnalysisInput = {
  address: Address;
  /** Max Blockscout pages to scan (newest first). */
  maxPages?: number;
};
