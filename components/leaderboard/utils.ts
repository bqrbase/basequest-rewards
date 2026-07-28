import type { LeaderboardEntry } from "@/lib/supabase/leaderboard";

export function normalizeWalletAddress(walletAddress?: string | null) {
  return walletAddress?.toLowerCase() ?? null;
}

/** Deterministic HSL pair from a wallet address for avatar gradients. */
export function walletAvatarColors(address: string): {
  from: string;
  to: string;
} {
  let hash = 0;
  const normalized = address.toLowerCase();
  for (let i = 0; i < normalized.length; i += 1) {
    hash = normalized.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  const hue2 = (hue + 42) % 360;
  return {
    from: `hsl(${hue} 72% 42%)`,
    to: `hsl(${hue2} 78% 28%)`,
  };
}

export function walletInitials(address: string) {
  if (address.length < 4) {
    return "??";
  }
  return `${address.slice(2, 4)}${address.slice(-2)}`.toUpperCase();
}

export type XpGap =
  | { kind: "ahead"; amount: number }
  | { kind: "need"; amount: number }
  | { kind: "leading" }
  | { kind: "tied" };

/** XP gap between this entry and the player ranked immediately above (or below for #1). */
export function getXpGapToNeighbor(
  entries: LeaderboardEntry[],
  index: number,
): XpGap {
  const entry = entries[index];
  if (!entry) {
    return { kind: "tied" };
  }

  if (index === 0) {
    const second = entries[1];
    if (!second) {
      return { kind: "leading" };
    }
    const amount = entry.total_xp - second.total_xp;
    if (amount <= 0) {
      return { kind: "tied" };
    }
    return { kind: "ahead", amount };
  }

  const above = entries[index - 1];
  const amount = above.total_xp - entry.total_xp;
  if (amount <= 0) {
    return { kind: "tied" };
  }
  return { kind: "need", amount };
}

export function formatXpGap(gap: XpGap): string {
  switch (gap.kind) {
    case "ahead":
      return `+${gap.amount.toLocaleString()} XP ahead`;
    case "need":
      return `Need ${gap.amount.toLocaleString()} XP to reach next rank`;
    case "leading":
      return "Leading the board";
    case "tied":
      return "Tied with neighbor";
  }
}

export function computeLeaderboardStats(entries: LeaderboardEntry[]) {
  const totalPlayers = entries.length;
  const totalXp = entries.reduce((sum, entry) => sum + entry.total_xp, 0);
  const highestStreak = entries.reduce(
    (max, entry) => Math.max(max, entry.streak),
    0,
  );

  return { totalPlayers, totalXp, highestStreak };
}
