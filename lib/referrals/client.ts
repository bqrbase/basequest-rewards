import type {
  ReferralDashboard,
  ReferralLeaderboardEntry,
} from "@/lib/referrals/types";

export async function fetchReferralDashboard(
  wallet: string,
): Promise<ReferralDashboard | null> {
  const response = await fetch(
    `/api/referrals/me?wallet=${encodeURIComponent(wallet)}`,
    { cache: "no-store" },
  );
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as ReferralDashboard;
}

export async function attributeReferralClient(params: {
  wallet: string;
  code: string;
}): Promise<{ ok: boolean }> {
  const response = await fetch("/api/referrals/attribute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    return { ok: false };
  }
  const body = (await response.json()) as { ok?: boolean };
  return { ok: Boolean(body.ok) };
}

export async function completeReferralClient(wallet: string): Promise<void> {
  try {
    await fetch("/api/referrals/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet }),
    });
  } catch {
    // Best-effort; next sync will retry.
  }
}

export async function fetchReferralLeaderboard(): Promise<
  ReferralLeaderboardEntry[]
> {
  const response = await fetch("/api/referrals/leaderboard", {
    cache: "no-store",
  });
  if (!response.ok) {
    return [];
  }
  const body = (await response.json()) as {
    entries?: ReferralLeaderboardEntry[];
  };
  return body.entries ?? [];
}
