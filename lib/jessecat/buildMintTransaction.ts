import { getAddress, isAddress, isHex, type Address, type Hex } from "viem";
import {
  JESSECAT_CHAIN_ID,
  JESSECAT_OPENSEA_SLUG,
} from "@/lib/jessecat/config";

const OPENSEA_API_BASE = "https://api.opensea.io/api/v2";

export type JesseCatMintTx = {
  to: Address;
  data: Hex;
  valueWei: bigint;
  chain: string | null;
  quantity: number;
};

export type JesseCatDropStageSummary = {
  label: string | null;
  price: string | null;
  maxPerWallet: number | null;
  startTime: string | null;
  endTime: string | null;
};

export type JesseCatDropSummary = {
  slug: string;
  collectionName: string | null;
  totalSupply: string | null;
  maxSupply: string | null;
  remaining: number | null;
  stages: JesseCatDropStageSummary[];
};

function getOpenSeaApiKey(): string | null {
  const key = process.env.OPENSEA_API_KEY?.trim();
  return key && key.length > 0 ? key : null;
}

function openSeaHeaders(): HeadersInit {
  const apiKey = getOpenSeaApiKey();
  if (!apiKey) {
    throw new Error("OPENSEA_API_KEY is not configured");
  }
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "x-api-key": apiKey,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function pickString(
  record: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function pickNumber(
  record: Record<string, unknown>,
  keys: string[],
): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

/** Accept decimal wei strings or 0x-hex quantities from OpenSea. */
export function parseOpenSeaWeiValue(raw: string): bigint {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("OpenSea mint response missing value.");
  }
  if (isHex(trimmed)) {
    return BigInt(trimmed);
  }
  if (!/^\d+$/.test(trimmed)) {
    throw new Error("OpenSea mint value is not a valid wei amount.");
  }
  return BigInt(trimmed);
}

function extractOpenSeaErrorMessage(body: unknown, status: number): string {
  const record = asRecord(body);
  if (record) {
    const errors = record.errors;
    if (Array.isArray(errors) && errors.length > 0) {
      const messages = errors
        .map((item) => (typeof item === "string" ? item : null))
        .filter((item): item is string => Boolean(item));
      if (messages.length > 0) {
        return messages.join(" · ");
      }
    }
    const message = pickString(record, ["message", "error", "detail"]);
    if (message) {
      return message;
    }
  }
  return `OpenSea request failed (${status}).`;
}

async function openSeaFetch(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`${OPENSEA_API_BASE}${path}`, {
    ...init,
    headers: {
      ...openSeaHeaders(),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  let body: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    throw new Error(extractOpenSeaErrorMessage(body, response.status));
  }

  return body;
}

/**
 * Normalize OpenSea DropMintResponse (`to`/`data`/`value`) and legacy
 * `target`/`calldata` aliases from docs/examples.
 */
export function normalizeDropMintResponse(
  body: unknown,
  quantity: number,
): JesseCatMintTx {
  const record = asRecord(body);
  if (!record) {
    throw new Error("OpenSea mint response was empty or invalid.");
  }

  const toRaw = pickString(record, ["to", "target"]);
  const dataRaw = pickString(record, ["data", "calldata"]);
  const valueRaw = pickString(record, ["value"]);

  if (!toRaw || !isAddress(toRaw)) {
    throw new Error("OpenSea mint response missing a valid target address.");
  }
  if (!dataRaw || !isHex(dataRaw)) {
    throw new Error("OpenSea mint response missing hex calldata.");
  }
  if (!valueRaw) {
    throw new Error("OpenSea mint response missing value.");
  }

  return {
    to: getAddress(toRaw),
    data: dataRaw as Hex,
    valueWei: parseOpenSeaWeiValue(valueRaw),
    chain: pickString(record, ["chain"]),
    quantity,
  };
}

export function normalizeDropSummary(body: unknown): JesseCatDropSummary {
  const record = asRecord(body);
  if (!record) {
    throw new Error("OpenSea drop response was empty or invalid.");
  }

  const totalSupply = pickString(record, ["totalSupply", "total_supply"]);
  const maxSupply = pickString(record, ["maxSupply", "max_supply"]);
  let remaining: number | null = null;
  if (totalSupply && maxSupply) {
    const total = Number(totalSupply);
    const max = Number(maxSupply);
    if (Number.isFinite(total) && Number.isFinite(max)) {
      remaining = Math.max(0, max - total);
    }
  }

  const stagesRaw = record.stages;
  const stages: JesseCatDropStageSummary[] = Array.isArray(stagesRaw)
    ? stagesRaw
        .map((stage) => {
          const stageRecord = asRecord(stage);
          if (!stageRecord) {
            return null;
          }
          return {
            label: pickString(stageRecord, ["label", "name"]),
            price: pickString(stageRecord, ["price", "mintPrice"]),
            maxPerWallet: pickNumber(stageRecord, [
              "maxPerWallet",
              "max_per_wallet",
              "maxTotalMintableByWallet",
            ]),
            startTime: pickString(stageRecord, ["startTime", "start_time"]),
            endTime: pickString(stageRecord, ["endTime", "end_time"]),
          } satisfies JesseCatDropStageSummary;
        })
        .filter((stage): stage is JesseCatDropStageSummary => stage !== null)
    : [];

  return {
    slug: pickString(record, ["collectionSlug", "slug"]) ?? JESSECAT_OPENSEA_SLUG,
    collectionName: pickString(record, ["collectionName", "name"]),
    totalSupply,
    maxSupply,
    remaining,
    stages,
  };
}

export async function fetchJesseCatDropSummary(): Promise<JesseCatDropSummary> {
  const body = await openSeaFetch(`/drops/${JESSECAT_OPENSEA_SLUG}`);
  return normalizeDropSummary(body);
}

export async function buildJesseCatMintTransaction(params: {
  minter: string;
  quantity: number;
}): Promise<JesseCatMintTx> {
  if (!isAddress(params.minter)) {
    throw new Error("A valid minter wallet address is required.");
  }
  if (
    !Number.isInteger(params.quantity) ||
    params.quantity < 1 ||
    params.quantity > 100
  ) {
    throw new Error("Quantity must be an integer between 1 and 100.");
  }

  const body = await openSeaFetch(`/drops/${JESSECAT_OPENSEA_SLUG}/mint`, {
    method: "POST",
    body: JSON.stringify({
      minter: getAddress(params.minter),
      quantity: params.quantity,
    }),
  });

  const mintTx = normalizeDropMintResponse(body, params.quantity);

  // Soft chain hint when OpenSea includes it (do not invent chain ids).
  if (mintTx.chain) {
    const chainLower = mintTx.chain.toLowerCase();
    const looksLikeBase =
      chainLower.includes("base") ||
      chainLower === String(JESSECAT_CHAIN_ID) ||
      chainLower === `eip155:${JESSECAT_CHAIN_ID}`;
    if (!looksLikeBase) {
      throw new Error(
        `OpenSea returned a non-Base mint chain (${mintTx.chain}).`,
      );
    }
  }

  return mintTx;
}

export function isOpenSeaApiConfigured(): boolean {
  return Boolean(getOpenSeaApiKey());
}
