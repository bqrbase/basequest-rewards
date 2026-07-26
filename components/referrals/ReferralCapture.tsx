"use client";

import {
  captureReferralCodeFromSearch,
  persistPendingReferralCode,
} from "@/lib/referrals";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Captures ?ref=CODE from the URL into localStorage for later attribution.
 */
export default function ReferralCapture() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = captureReferralCodeFromSearch(searchParams);
    if (code) {
      persistPendingReferralCode(code);
    }
  }, [searchParams]);

  return null;
}
