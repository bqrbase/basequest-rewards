import { ChainId } from "@lifi/sdk";
import type { Address } from "viem";
import { zeroAddress } from "viem";
import { getSwapToken, type SwapToken } from "@/lib/swap/tokens";

export type BridgeSourceChainId =
  | typeof ChainId.ETH
  | typeof ChainId.ARB
  | typeof ChainId.OPT
  | typeof ChainId.POL;

export type BridgeToken = SwapToken & {
  chainId: BridgeSourceChainId;
};

export type BridgeSourceChain = {
  id: BridgeSourceChainId;
  name: string;
  shortName: string;
  explorerTxUrl: (txHash: string) => string;
};

export const BRIDGE_DEST_CHAIN_ID = ChainId.BAS;

export const BRIDGE_SOURCE_CHAINS: BridgeSourceChain[] = [
  {
    id: ChainId.ETH,
    name: "Ethereum",
    shortName: "Ethereum",
    explorerTxUrl: (txHash) => `https://etherscan.io/tx/${txHash}`,
  },
  {
    id: ChainId.ARB,
    name: "Arbitrum",
    shortName: "Arbitrum",
    explorerTxUrl: (txHash) => `https://arbiscan.io/tx/${txHash}`,
  },
  {
    id: ChainId.OPT,
    name: "Optimism",
    shortName: "Optimism",
    explorerTxUrl: (txHash) => `https://optimistic.etherscan.io/tx/${txHash}`,
  },
  {
    id: ChainId.POL,
    name: "Polygon",
    shortName: "Polygon",
    explorerTxUrl: (txHash) => `https://polygonscan.com/tx/${txHash}`,
  },
];

const BRIDGE_TOKENS_BY_CHAIN: Record<BridgeSourceChainId, BridgeToken[]> = {
  [ChainId.ETH]: [
    {
      chainId: ChainId.ETH,
      symbol: "ETH",
      name: "Ether",
      address: zeroAddress,
      decimals: 18,
    },
    {
      chainId: ChainId.ETH,
      symbol: "USDC",
      name: "USD Coin",
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      decimals: 6,
    },
    {
      chainId: ChainId.ETH,
      symbol: "USDT",
      name: "Tether USD",
      address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      decimals: 6,
    },
  ],
  [ChainId.ARB]: [
    {
      chainId: ChainId.ARB,
      symbol: "ETH",
      name: "Ether",
      address: zeroAddress,
      decimals: 18,
    },
    {
      chainId: ChainId.ARB,
      symbol: "USDC",
      name: "USD Coin",
      address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      decimals: 6,
    },
    {
      chainId: ChainId.ARB,
      symbol: "USDT",
      name: "Tether USD",
      address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
      decimals: 6,
    },
  ],
  [ChainId.OPT]: [
    {
      chainId: ChainId.OPT,
      symbol: "ETH",
      name: "Ether",
      address: zeroAddress,
      decimals: 18,
    },
    {
      chainId: ChainId.OPT,
      symbol: "USDC",
      name: "USD Coin",
      address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
      decimals: 6,
    },
    {
      chainId: ChainId.OPT,
      symbol: "USDT",
      name: "Tether USD",
      address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
      decimals: 6,
    },
  ],
  [ChainId.POL]: [
    {
      chainId: ChainId.POL,
      symbol: "POL",
      name: "Polygon",
      address: zeroAddress,
      decimals: 18,
    },
    {
      chainId: ChainId.POL,
      symbol: "USDC",
      name: "USD Coin",
      address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
      decimals: 6,
    },
    {
      chainId: ChainId.POL,
      symbol: "WETH",
      name: "Wrapped Ether",
      address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
      decimals: 18,
    },
  ],
};

/** Base receive token for USDT (not in Quick Swap list). */
const BASE_USDT: SwapToken = {
  symbol: "USDT",
  name: "Tether USD",
  address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2" as Address,
  decimals: 6,
};

export function getBridgeSourceChain(
  chainId: number,
): BridgeSourceChain | undefined {
  return BRIDGE_SOURCE_CHAINS.find((chain) => chain.id === chainId);
}

export function getBridgeTokensForChain(
  chainId: BridgeSourceChainId,
): BridgeToken[] {
  return BRIDGE_TOKENS_BY_CHAIN[chainId] ?? [];
}

export function getBridgeToken(
  chainId: BridgeSourceChainId,
  symbol: string,
): BridgeToken | undefined {
  return getBridgeTokensForChain(chainId).find(
    (token) => token.symbol === symbol,
  );
}

/**
 * Map a source bridge token to the preferred Base receive asset.
 */
export function resolveBaseReceiveToken(fromToken: BridgeToken): SwapToken {
  if (fromToken.symbol === "USDC") {
    return getSwapToken("USDC") ?? BASE_USDT;
  }
  if (fromToken.symbol === "USDT") {
    return BASE_USDT;
  }
  if (fromToken.symbol === "WETH" || fromToken.symbol === "ETH") {
    return getSwapToken("ETH")!;
  }
  // POL and other assets: default to ETH on Base via LI.FI routing.
  return getSwapToken("ETH")!;
}
