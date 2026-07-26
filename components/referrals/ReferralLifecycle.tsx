"use client";

import {
  attributeReferralClient,
  completeReferralClient,
} from "@/lib/referrals/client";
import {
  clearPendingReferralCode,
  readPendingReferralCode,
} from "@/lib/referrals";
import { useEffect, useRef } from "react";
import { useAccount } from "wagmi";

/**
 * On wallet connect: attribute a pending ?ref= code, then attempt completion
 * (idempotent if onboarding is already done).
 */
export default function ReferralLifecycle() {
  const { address, status } = useAccount();
  const attributedFor = useRef<string | null>(null);

  useEffect(() => {
    if (status !== "connected" || !address) {
      return;
    }

    const wallet = address.toLowerCase();
    if (attributedFor.current === wallet) {
      return;
    }

    const pendingCode = readPendingReferralCode();
    if (!pendingCode) {
      // Still try completion for already-attributed pending rows.
      attributedFor.current = wallet;
      void completeReferralClient(wallet);
      return;
    }

    attributedFor.current = wallet;

    void attributeReferralClient({ wallet, code: pendingCode }).then(
      (result) => {
        if (result.ok) {
          clearPendingReferralCode();
        } else {
          attributedFor.current = null;
        }
        void completeReferralClient(wallet);
      },
    );
  }, [status, address]);

  return null;
}
