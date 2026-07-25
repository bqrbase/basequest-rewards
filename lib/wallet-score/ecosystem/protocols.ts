/**
 * Curated Base mainnet contracts mapped to ecosystem protocols.
 * Addresses are stored lowercase for O(1) lookup.
 *
 * Primary detection: exact address (and proxy implementation addresses).
 * Fallback only: Blockscout labels / protocol tags when the address is unknown.
 */
export type BaseProtocolDefinition = {
  id: string;
  name: string;
};

export const BASE_PROTOCOL_BY_ADDRESS: Record<string, BaseProtocolDefinition> = {
  // Aerodrome
  "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43": {
    id: "aerodrome",
    name: "Aerodrome",
  },
  "0x420dd381b31aef6683db6b902084cb0ffece40da": {
    id: "aerodrome",
    name: "Aerodrome",
  },
  "0x16613524e02ad97edfef411be7139643229f6ff9": {
    id: "aerodrome",
    name: "Aerodrome",
  },
  // Aerodrome Slipstream CLPool implementation (eip1167 proxies point here)
  "0xec8e5342b19977b4ef8892e02d8daecfa1315831": {
    id: "aerodrome",
    name: "Aerodrome",
  },
  // Aerodrome basic/stable Pool implementation
  "0xa4e46b4f701c62e14df11b48dce76a7d793cd6d7": {
    id: "aerodrome",
    name: "Aerodrome",
  },

  // Uniswap
  "0x2626664c2603336e57b271c5c0b26f421741e481": {
    id: "uniswap",
    name: "Uniswap",
  },
  "0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad": {
    id: "uniswap",
    name: "Uniswap",
  },
  "0x198ef79f1f515f02dfe7188e0b555e9a1c32dcc9": {
    id: "uniswap",
    name: "Uniswap",
  },
  "0x33128a8fc17869897dce68ed026d694621f6fdfd": {
    id: "uniswap",
    name: "Uniswap",
  },
  // Uniswap v4 Universal Router on Base (common swap entrypoint)
  "0xfdf682f51fe81aa4898f0ae2163d8a55c127fbc7": {
    id: "uniswap",
    name: "Uniswap",
  },

  // Aave
  "0xa238dd80c259a72e81d7e4664a9801593f98d1c5": {
    id: "aave",
    name: "Aave",
  },
  "0x18cd499e31cc8499ed6ec88829e992bbac86223a": {
    id: "aave",
    name: "Aave",
  },

  // Base Bridge / system
  "0x4200000000000000000000000000000000000010": {
    id: "base-bridge",
    name: "Base Bridge",
  },
  "0x3154cf16ccdb4c6d922629664174b904d80f2c35": {
    id: "base-bridge",
    name: "Base Bridge",
  },

  // OpenSea / Seaport
  "0x00000000000000adc04c56bf30ac9d3c0aaf14dc": {
    id: "opensea",
    name: "OpenSea",
  },
  "0x0000000000000068f116a894984e2db1123eb395": {
    id: "opensea",
    name: "OpenSea",
  },

  // 1inch
  "0x1111111254eeb25477b68fb85ed929f73a960582": {
    id: "1inch",
    name: "1inch",
  },
  "0x111111125421ca6dc452d289314280a0f8842a65": {
    id: "1inch",
    name: "1inch",
  },

  // Moonwell
  "0xfbb21d0380bee3312b33c4353c8936a0f9259234": {
    id: "moonwell",
    name: "Moonwell",
  },

  // Compound III (USDC on Base)
  "0x9c4ec768c28520b50860ea7a86e6b1264bda6c47": {
    id: "compound",
    name: "Compound",
  },

  // Zora
  "0x04e2516a2c207e84a1839755675dfd8ef6302f0a": {
    id: "zora",
    name: "Zora",
  },
  "0x7777777f279eba3d3ad8f4e708545291a6fdba8b": {
    id: "zora",
    name: "Zora",
  },
  "0x777777c338d93e2c7adf08d102ce628e594bf203": {
    id: "zora",
    name: "Zora",
  },
  "0x777777751622c0d2457ca91ead7bc2cc7d3ec6c9": {
    id: "zora",
    name: "Zora",
  },
  // Detected Zora Coin (DropERC20) interactions on Base
  "0xc6b4444073f4ee01f707253e6d915b3ff337711b": {
    id: "zora",
    name: "Zora",
  },
  "0xd9e1488c50b94bb4f7fbe5afc639c3603a615a54": {
    id: "zora",
    name: "Zora",
  },
  // DropERC20 implementation used by Zora Coin proxies
  "0x3de12ec4085edb23c512f28409ff5ef7c9dd15c5": {
    id: "zora",
    name: "Zora",
  },
};

/** Normalize an address for registry lookup. */
export function normalizeContractAddress(value: string): string {
  return value.trim().toLowerCase();
}

export function resolveBaseProtocol(
  address: string,
): BaseProtocolDefinition | null {
  return BASE_PROTOCOL_BY_ADDRESS[normalizeContractAddress(address)] ?? null;
}

/**
 * Label → protocol map for Blockscout contract names / OLI protocol tags.
 * Order matters: first match wins.
 */
const PROTOCOL_LABEL_MATCHERS: Array<{
  id: string;
  name: string;
  pattern: RegExp;
}> = [
  { id: "uniswap", name: "Uniswap", pattern: /uniswap/i },
  { id: "aerodrome", name: "Aerodrome", pattern: /aerodrome|clpool/i },
  { id: "zora", name: "Zora", pattern: /\bzora\b/i },
  { id: "aave", name: "Aave", pattern: /\baave\b/i },
  { id: "opensea", name: "OpenSea", pattern: /opensea|seaport/i },
  { id: "1inch", name: "1inch", pattern: /1inch/i },
  { id: "moonwell", name: "Moonwell", pattern: /moonwell/i },
  { id: "compound", name: "Compound", pattern: /\bcompound\b/i },
  { id: "base-bridge", name: "Base Bridge", pattern: /base\s*bridge|l1standardbridge|l2standardbridge/i },
];

function resolveBaseProtocolFromLabel(
  label: string,
): BaseProtocolDefinition | null {
  const trimmed = label.trim();
  if (!trimmed) {
    return null;
  }

  for (const matcher of PROTOCOL_LABEL_MATCHERS) {
    if (matcher.pattern.test(trimmed)) {
      return { id: matcher.id, name: matcher.name };
    }
  }

  return null;
}

export type BaseProtocolResolveHints = {
  /** Primary `tx.to` contract address. */
  address: string;
  /** Contract name, protocol tags, implementation names, etc. */
  labels?: readonly string[];
  /** Proxy implementation addresses from Blockscout. */
  relatedAddresses?: readonly string[];
};

/**
 * Resolve a protocol with address matching as the primary method:
 * 1) `tx.to` address in registry
 * 2) proxy implementation addresses in registry
 * 3) Blockscout labels / protocol tags (fallback only)
 */
export function resolveBaseProtocolFromHints(
  hints: BaseProtocolResolveHints,
): BaseProtocolDefinition | null {
  const direct = resolveBaseProtocol(hints.address);
  if (direct) {
    return direct;
  }

  for (const related of hints.relatedAddresses ?? []) {
    const hit = resolveBaseProtocol(related);
    if (hit) {
      return hit;
    }
  }

  // Fallback: labels only when address (and impl addresses) are unknown.
  for (const label of hints.labels ?? []) {
    const hit = resolveBaseProtocolFromLabel(label);
    if (hit) {
      return hit;
    }
  }

  return null;
}
