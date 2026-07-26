import type { Address } from "viem";
import { zeroAddress } from "viem";

export type SwapToken = {
  symbol: string;
  name: string;
  address: Address;
  decimals: number;
};

/** Supported Quick Swap tokens on Base Mainnet. */
export const BASE_SWAP_TOKENS: SwapToken[] = [
  {
    symbol: "ETH",
    name: "Ethereum",
    address: zeroAddress,
    decimals: 18,
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    decimals: 6,
  },
  {
    symbol: "cbETH",
    name: "Coinbase Wrapped Ether",
    address: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22",
    decimals: 18,
  },
  {
    symbol: "AERO",
    name: "Aerodrome",
    address: "0x940181a94A35A4569E4529A3CDfB74e38FD98631",
    decimals: 18,
  },
];

export function getSwapToken(symbol: string): SwapToken | undefined {
  return BASE_SWAP_TOKENS.find((token) => token.symbol === symbol);
}
