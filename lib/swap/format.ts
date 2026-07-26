import { formatUnits } from "viem";

export function parseSwapAmount(value: string): number | null {
  if (!value.trim()) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function formatTokenAmount(
  amount: string | bigint,
  decimals: number,
): string {
  try {
    const asNumber = Number(formatUnits(BigInt(amount), decimals));
    if (!Number.isFinite(asNumber)) {
      return formatUnits(BigInt(amount), decimals);
    }
    if (asNumber === 0) {
      return "0";
    }
    if (asNumber >= 1000) {
      return asNumber.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }
    if (asNumber >= 1) {
      return asNumber.toLocaleString(undefined, { maximumFractionDigits: 4 });
    }
    return asNumber.toLocaleString(undefined, { maximumFractionDigits: 6 });
  } catch {
    return String(amount);
  }
}

export function formatUsd(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }
  if (value < 0.01 && value > 0) {
    return "<$0.01";
  }
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatPriceImpact(percent: number | null): string {
  if (percent === null || !Number.isFinite(percent)) {
    return "—";
  }
  const abs = Math.abs(percent);
  if (abs < 0.01) {
    return "<0.01%";
  }
  return `${percent >= 0 ? "" : "-"}${abs.toFixed(2)}%`;
}
