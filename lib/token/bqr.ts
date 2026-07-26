import type { Address } from "viem";

/**
 * BaseQuest Rewards (BQR) token metadata.
 * BQR is a Base B20 Asset (ERC-20 compatible for reads).
 */
export const BQR_TOKEN = {
  name: "BaseQuest Rewards",
  symbol: "BQR",
  network: "Base Mainnet",
  chainId: 8453,
  totalSupply: "1,000,000,000",
  contractAddress: "0xB200000000000000000000Bf7E6dcf0cF466939a",
} as const;

/** Resolve BQR token address (env override, else deployed constant). */
export function getBqrTokenAddress(): Address {
  const fromEnv = process.env.NEXT_PUBLIC_BQR_TOKEN?.trim();
  if (fromEnv && /^0x[a-fA-F0-9]{40}$/.test(fromEnv)) {
    return fromEnv as Address;
  }
  return BQR_TOKEN.contractAddress as Address;
}

export function getBqrExplorerUrl(contractAddress = getBqrTokenAddress()) {
  return `https://basescan.org/address/${contractAddress}`;
}

