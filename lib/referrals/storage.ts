import {
  REFERRAL_PENDING_CODE_KEY,
  REFERRAL_QUERY_PARAM,
} from "@/lib/referrals/constants";

function normalizeClientCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function captureReferralCodeFromSearch(
  search: string | URLSearchParams,
): string | null {
  const params =
    typeof search === "string"
      ? new URLSearchParams(
          search.startsWith("?") ? search.slice(1) : search,
        )
      : search;
  const raw = params.get(REFERRAL_QUERY_PARAM);
  if (!raw) {
    return null;
  }
  const normalized = normalizeClientCode(raw);
  if (normalized.length < 6) {
    return null;
  }
  return normalized;
}

export function persistPendingReferralCode(code: string): void {
  if (typeof window === "undefined") {
    return;
  }
  const normalized = normalizeClientCode(code);
  if (normalized.length < 6) {
    return;
  }
  window.localStorage.setItem(REFERRAL_PENDING_CODE_KEY, normalized);
}

export function readPendingReferralCode(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.localStorage.getItem(REFERRAL_PENDING_CODE_KEY);
  if (!raw) {
    return null;
  }
  const normalized = normalizeClientCode(raw);
  return normalized.length >= 6 ? normalized : null;
}

export function clearPendingReferralCode(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(REFERRAL_PENDING_CODE_KEY);
}

export function buildReferralLink(origin: string, code: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/?${REFERRAL_QUERY_PARAM}=${encodeURIComponent(code)}`;
}
