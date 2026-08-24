import {
  BLOCKSCOUT_BASE_API_V2,
  USDC_BASE_ADDRESS,
} from "@/lib/wallet-score/constants";
import type { RewardToken, TokenUsdPrices } from "@/lib/task2earn/types";

type BlockscoutStats = {
  coin_price?: string | number | null;
};

type BlockscoutToken = {
  exchange_rate?: string | number | null;
};

function parsePositiveRate(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const rate = Number(value);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

/**
 * USD prices from Blockscout only. BQR has no reliable source here.
 * Never invent or assume a 1:1 USDC rate if Blockscout omits exchange_rate.
 */
export async function fetchTokenUsdPrices(): Promise<TokenUsdPrices> {
  const prices: TokenUsdPrices = { BQR: null, USDC: null, ETH: null };

  try {
    const statsResponse = await fetch(`${BLOCKSCOUT_BASE_API_V2}/stats`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (statsResponse.ok) {
      const stats = (await statsResponse.json()) as BlockscoutStats;
      prices.ETH = parsePositiveRate(stats.coin_price);
    }
  } catch (error) {
    console.error("[task2earn] ETH USD price unavailable", error);
  }

  try {
    const tokenResponse = await fetch(
      `${BLOCKSCOUT_BASE_API_V2}/tokens/${USDC_BASE_ADDRESS}`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (tokenResponse.ok) {
      const token = (await tokenResponse.json()) as BlockscoutToken;
      prices.USDC = parsePositiveRate(token.exchange_rate);
    }
  } catch (error) {
    console.error("[task2earn] USDC USD price unavailable", error);
  }

  return prices;
}

export function estimatePoolUsd(
  token: RewardToken,
  poolAmount: number,
  prices: TokenUsdPrices,
): number | null {
  const rate = prices[token];
  if (rate === null || !Number.isFinite(poolAmount) || poolAmount <= 0) {
    return null;
  }
  return poolAmount * rate;
}

export function feeTokenAmountFromUsd(
  token: RewardToken,
  feeUsd: number,
  prices: TokenUsdPrices,
): number {
  const rate = prices[token];
  if (rate === null || rate <= 0) {
    return 0;
  }
  return feeUsd / rate;
}
