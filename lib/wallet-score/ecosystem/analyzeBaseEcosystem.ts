import { cachedJsonGet } from "@/lib/wallet-score/cache";
import { BLOCKSCOUT_BASE_API_V2 } from "@/lib/wallet-score/constants";
import {
  normalizeContractAddress,
  resolveBaseProtocolFromHints,
} from "@/lib/wallet-score/ecosystem/protocols";
import type {
  BaseEcosystemAnalysis,
  BaseEcosystemAnalysisInput,
  EcosystemProtocolHit,
} from "@/lib/wallet-score/ecosystem/types";
import {
  clamp,
  linearScore,
  logScore,
} from "@/lib/wallet-score/scoring/normalize";
import type { Address } from "viem";

type BlockscoutTag = {
  tagType?: string;
  name?: string;
  meta?: {
    main_entity?: string;
    projectName?: string;
  };
};

type BlockscoutImplementation = {
  address_hash?: string;
  name?: string | null;
};

type BlockscoutAddressRef = {
  hash?: string;
  is_contract?: boolean;
  name?: string | null;
  implementations?: BlockscoutImplementation[] | null;
  metadata?: {
    tags?: BlockscoutTag[] | null;
  } | null;
};

type BlockscoutTx = {
  to?: BlockscoutAddressRef | null;
  created_contract?: BlockscoutAddressRef | null;
};

type BlockscoutTxPage = {
  items?: BlockscoutTx[];
  next_page_params?: Record<string, string | number> | null;
};

/** Keep close to activity scanning so older protocol hits (e.g. Zora) are not dropped. */
const DEFAULT_MAX_PAGES = 20;

/**
 * Mirrors the Base Ecosystem Usage curve in the scoring engine.
 * Kept here so the analysis module can report contribution without
 * changing calculateWalletScore structure.
 */
export function computeEcosystemScoreContribution(
  protocolsUsed: number,
  contractInteractions: number,
): number {
  return (
    Math.round(
      clamp(
        0.45 * linearScore(protocolsUsed, 8) +
          0.55 * logScore(contractInteractions, 500),
      ) * 10,
    ) / 10
  );
}

function toQueryParams(
  params: Record<string, string | number>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => [key, String(value)]),
  );
}

async function fetchAddressTransactions(
  address: Address,
  params?: Record<string, string>,
): Promise<BlockscoutTxPage> {
  const url = new URL(
    `${BLOCKSCOUT_BASE_API_V2}/addresses/${address}/transactions`,
  );

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  return cachedJsonGet<BlockscoutTxPage>(url.toString(), {
    errorPrefix: "Blockscout HTTP",
    revalidateSeconds: 60,
  });
}

function collectLabels(ref: BlockscoutAddressRef): string[] {
  const labels: string[] = [];

  if (ref.name) {
    labels.push(ref.name);
  }

  for (const tag of ref.metadata?.tags ?? []) {
    if (tag.tagType === "protocol" && tag.name) {
      labels.push(tag.name);
    }
    if (tag.meta?.main_entity) {
      labels.push(tag.meta.main_entity);
    }
    if (tag.meta?.projectName) {
      labels.push(tag.meta.projectName);
    }
  }

  for (const impl of ref.implementations ?? []) {
    if (impl.name) {
      labels.push(impl.name);
    }
  }

  return labels;
}

function collectRelatedAddresses(ref: BlockscoutAddressRef): string[] {
  const related: string[] = [];
  for (const impl of ref.implementations ?? []) {
    if (impl.address_hash) {
      related.push(normalizeContractAddress(impl.address_hash));
    }
  }
  return related;
}

/**
 * Extract the interacted contract + Blockscout hints used for protocol matching.
 * Primary target is still `to` when `is_contract`, else created contracts.
 */
function targetContract(tx: BlockscoutTx): {
  address: string;
  labels: string[];
  relatedAddresses: string[];
} | null {
  const ref =
    tx.to?.hash && tx.to.is_contract
      ? tx.to
      : tx.created_contract?.hash
        ? tx.created_contract
        : null;

  if (!ref?.hash) {
    return null;
  }

  return {
    address: normalizeContractAddress(ref.hash),
    labels: collectLabels(ref),
    relatedAddresses: collectRelatedAddresses(ref),
  };
}

/**
 * Analyze a wallet's recent Base contract interactions against known
 * ecosystem protocols (Aerodrome, Uniswap, Aave, Bridge, etc.).
 */
export async function analyzeBaseEcosystem(
  input: BaseEcosystemAnalysisInput,
): Promise<BaseEcosystemAnalysis> {
  const { address, maxPages = DEFAULT_MAX_PAGES } = input;

  try {
    const protocolInteractions = new Map<
      string,
      { name: string; interactions: number; contracts: Set<string> }
    >();
    const uniqueContracts = new Set<string>();
    let contractInteractions = 0;
    let transactionsScanned = 0;

    let pageParams: Record<string, string> | undefined;
    let pages = 0;

    while (pages < maxPages) {
      const page = await fetchAddressTransactions(address, pageParams);
      const items = page.items ?? [];

      if (items.length === 0) {
        break;
      }

      for (const tx of items) {
        transactionsScanned += 1;
        const target = targetContract(tx);
        if (!target) {
          continue;
        }

        const protocol = resolveBaseProtocolFromHints(target);
        if (!protocol) {
          continue;
        }

        contractInteractions += 1;
        uniqueContracts.add(target.address);

        const existing = protocolInteractions.get(protocol.id);
        if (existing) {
          existing.interactions += 1;
          existing.contracts.add(target.address);
        } else {
          protocolInteractions.set(protocol.id, {
            name: protocol.name,
            interactions: 1,
            contracts: new Set([target.address]),
          });
        }
      }

      pages += 1;
      const next = page.next_page_params;
      if (!next) {
        break;
      }
      pageParams = toQueryParams(next);
    }

    const protocols: EcosystemProtocolHit[] = [...protocolInteractions.entries()]
      .map(([id, value]) => ({
        id,
        name: value.name,
        interactions: value.interactions,
        contracts: [...value.contracts],
      }))
      .sort((a, b) => b.interactions - a.interactions);

    const protocolsUsed = protocols.length;
    const ecosystemScore = computeEcosystemScoreContribution(
      protocolsUsed,
      contractInteractions,
    );

    return {
      protocolsUsed,
      contractInteractions,
      uniqueContracts: uniqueContracts.size,
      ecosystemScore,
      protocols,
      transactionsScanned,
      source: "blockscout",
    };
  } catch (error) {
    return {
      protocolsUsed: 0,
      contractInteractions: 0,
      uniqueContracts: 0,
      ecosystemScore: 0,
      protocols: [],
      transactionsScanned: 0,
      source: "unavailable",
      error:
        error instanceof Error ? error.message : "Ecosystem analysis failed",
    };
  }
}
