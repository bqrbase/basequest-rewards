"use client";

import GlassPanel from "@/components/GlassPanel";
import type { QuestProgress, QuestStatus } from "@/lib/quest-engine";
import {
  X402_CHAIN_ID,
  X402_NETWORK,
  X402_PREMIUM_TEST_PATH,
  X402_PRICE,
} from "@/lib/x402/config";
import { useEnsureBaseMainnet } from "@/hooks/useEnsureBaseMainnet";
import { getBaseScanTxUrl, payPremiumTest } from "@/lib/x402/payPremiumTest";
import { ui } from "@/lib/ui-styles";
import {
  BASE_MAINNET_REQUIRED_MESSAGE,
  isBaseMainnetSwitchRejected,
} from "@/lib/wallet/ensureBaseMainnet";
import { useEffect, useId, useState } from "react";
import type { Hash } from "viem";
import { useAccount, useConfig } from "wagmi";

type X402PaymentModalProps = {
  open: boolean;
  onClose: () => void;
  questStatus: QuestStatus;
  onQuestCompleted: (progress: QuestProgress) => void;
};

type ModalStep = "start" | "paying" | "success";

type PaymentSuccessState = {
  txHash: Hash;
  network: string;
  amount: string;
};

/**
 * Make an x402 Payment quest — calls GET /api/premium/test via @x402/fetch.
 */
export default function X402PaymentModal({
  open,
  onClose,
  questStatus,
  onQuestCompleted,
}: X402PaymentModalProps) {
  const titleId = useId();
  const config = useConfig();
  const { address, status: walletStatus } = useAccount();
  const { ensureBaseMainnetReady } = useEnsureBaseMainnet();
  const isWalletConnected = walletStatus === "connected" && Boolean(address);

  const [step, setStep] = useState<ModalStep>("start");
  const [isPaying, setIsPaying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState<PaymentSuccessState | null>(null);

  useEffect(() => {
    if (!open) {
      setStep("start");
      setIsPaying(false);
      setErrorMessage(null);
      setSuccess(null);
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isPaying) {
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, isPaying]);

  async function handleStart() {
    if (!address || !isWalletConnected || isPaying) {
      setErrorMessage("Connect your wallet to start.");
      return;
    }

    if (questStatus === "completed") {
      setErrorMessage("You already completed the x402 payment quest.");
      return;
    }

    setIsPaying(true);
    setErrorMessage(null);
    setStep("paying");

    try {
      await ensureBaseMainnetReady();

      // Calls GET /api/premium/test. On 402, @x402/fetch runs the payment flow.
      const result = await payPremiumTest({
        config,
        walletAddress: address,
      });

      if (!result.ok) {
        setErrorMessage(result.message);
        setStep("start");
        return;
      }

      const saveResponse = await fetch("/api/x402/payments/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          wallet: address,
          txHash: result.txHash,
          amount: result.amount,
          network: result.network,
        }),
      });

      const saveJson = (await saveResponse.json()) as {
        success?: boolean;
        error?: string;
        supabase?: {
          code?: string | null;
          message?: string | null;
          details?: string | null;
          hint?: string | null;
        };
      };

      setSuccess({
        txHash: result.txHash,
        network: result.network,
        amount: result.amount,
      });
      setStep("success");

      if (!saveResponse.ok || !saveJson.success) {
        console.error(
          "[X402PaymentModal] /api/x402/payments/save failed:",
          saveJson,
        );
        const supabaseParts = [
          saveJson.supabase?.code ? `code=${saveJson.supabase.code}` : null,
          saveJson.supabase?.message || saveJson.error || null,
          saveJson.supabase?.details
            ? `details=${saveJson.supabase.details}`
            : null,
          saveJson.supabase?.hint ? `hint=${saveJson.supabase.hint}` : null,
        ].filter(Boolean);

        setErrorMessage(
          supabaseParts.length > 0
            ? supabaseParts.join(" | ")
            : "Payment succeeded onchain, but saving failed.",
        );
        return;
      }

      const completeResponse = await fetch(
        "/api/quests/x402-payment/complete",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            wallet: address,
            txHash: result.txHash,
          }),
        },
      );

      const completeJson = (await completeResponse.json()) as {
        success?: boolean;
        error?: string;
        progress?: QuestProgress;
      };

      if (
        completeResponse.ok &&
        completeJson.success &&
        completeJson.progress
      ) {
        onQuestCompleted(completeJson.progress);
        return;
      }

      setErrorMessage(
        completeJson.error ||
          "Payment saved, but quest completion failed. Refresh and check progress.",
      );
    } catch (error) {
      if (isBaseMainnetSwitchRejected(error)) {
        setErrorMessage(BASE_MAINNET_REQUIRED_MESSAGE);
      } else {
        console.error("[X402PaymentModal] payment failed:", error);
        setErrorMessage(
          error instanceof Error ? error.message : String(error),
        );
      }
      setStep("start");
    } finally {
      setIsPaying(false);
    }
  }

  if (!open) {
    return null;
  }

  const explorerUrl = success
    ? getBaseScanTxUrl(success.txHash, X402_CHAIN_ID)
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        aria-label="Close x402 payment modal"
        className="absolute inset-0 bg-[#050814]/70 backdrop-blur-sm"
        onClick={() => {
          if (!isPaying) {
            onClose();
          }
        }}
      />

      <GlassPanel className="relative z-10 w-full max-w-lg p-5 sm:p-6">
        {step === "start" || step === "paying" ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={ui.sectionHeading}>x402</p>
                <h2
                  id={titleId}
                  className="mt-1.5 font-sans text-xl font-bold tracking-tight text-white sm:text-2xl"
                >
                  Make an x402 Payment
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-white/55">
                  Start the premium test endpoint. If payment is required
                  (HTTP 402), confirm the x402 payment in your wallet.
                </p>
              </div>
              <button
                type="button"
                disabled={isPaying}
                onClick={onClose}
                className={`${ui.secondaryButton} shrink-0 px-3 py-2 text-xs`}
              >
                Close
              </button>
            </div>

            <div className={`${ui.glassRow} mt-5 space-y-3 p-4`}>
              <div>
                <p className="text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-white/45">
                  Endpoint
                </p>
                <p className="mt-2 break-all font-mono text-sm text-cyan-100">
                  {X402_PREMIUM_TEST_PATH}
                </p>
              </div>
              <div>
                <p className="text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-white/45">
                  Network
                </p>
                <p className="mt-1 text-sm text-white/70">
                  Base Mainnet ({X402_NETWORK}) · {X402_PRICE} USDC
                </p>
              </div>
            </div>

            {step === "paying" ? (
              <p className="mt-4 text-center text-xs text-cyan-100/90">
                Payment required — confirm the x402 signature in your wallet…
              </p>
            ) : null}

            {!isWalletConnected ? (
              <p className="mt-4 text-center text-xs text-rose-300/90">
                Connect your wallet to start.
              </p>
            ) : null}

            {errorMessage ? (
              <p className="mt-4 text-center text-xs text-rose-300/90">
                {errorMessage}
              </p>
            ) : null}

            <button
              type="button"
              disabled={
                isPaying || !isWalletConnected || questStatus === "completed"
              }
              onClick={() => void handleStart()}
              className={`${
                isPaying || !isWalletConnected || questStatus === "completed"
                  ? `${ui.secondaryButton} cursor-not-allowed opacity-70`
                  : ui.primaryButton
              } mt-5 w-full`}
            >
              {isPaying
                ? "Waiting for payment…"
                : questStatus === "completed"
                  ? "Already Completed"
                  : "Start"}
            </button>
          </>
        ) : null}

        {step === "success" && success ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={ui.sectionHeading}>Success</p>
                <h2
                  id={titleId}
                  className="mt-1.5 font-sans text-xl font-bold tracking-tight text-white sm:text-2xl"
                >
                  Payment Complete
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-white/55">
                  Your x402 payment settled on Base. The quest is complete.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className={`${ui.secondaryButton} shrink-0 px-3 py-2 text-xs`}
              >
                Close
              </button>
            </div>

            <div className={`${ui.glassRow} mt-5 space-y-3 p-4`}>
              <div>
                <p className="text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-white/45">
                  Amount
                </p>
                <p className="mt-1 font-mono text-sm text-white">
                  {success.amount}
                </p>
              </div>
              <div>
                <p className="text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-white/45">
                  Network
                </p>
                <p className="mt-1 font-mono text-sm text-white/80">
                  {success.network}
                </p>
              </div>
              <div>
                <p className="text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-white/45">
                  Transaction Hash
                </p>
                <p className="mt-1 break-all font-mono text-sm text-cyan-100">
                  {success.txHash}
                </p>
              </div>
              {explorerUrl ? (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${ui.secondaryButton} inline-flex w-full items-center justify-center`}
                >
                  View on BaseScan
                </a>
              ) : null}
            </div>

            {errorMessage ? (
              <p className="mt-4 text-center text-xs text-rose-300/90">
                {errorMessage}
              </p>
            ) : (
              <p className="mt-4 text-center text-xs text-emerald-200/80">
                +100 XP awarded
              </p>
            )}

            <button
              type="button"
              onClick={onClose}
              className={`${ui.primaryButton} mt-5 w-full`}
            >
              Done
            </button>
          </>
        ) : null}
      </GlassPanel>
    </div>
  );
}
