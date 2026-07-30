"use client";

import GlassPanel from "@/components/GlassPanel";
import { DATA_SUFFIX } from "@/lib/builderCode";
import {
  claimBaseQuestBadge,
  getBaseQuestBadgeAddress,
  getBaseScanAddressUrl,
  getBaseScanNftUrl,
} from "@/lib/contracts/claim/baseQuestBadge";
import { useEnsureBaseMainnet } from "@/hooks/useEnsureBaseMainnet";
import type { QuestProgress, QuestStatus } from "@/lib/quest-engine";
import { formatWalletAddress, ui } from "@/lib/ui-styles";
import {
  BASE_MAINNET_REQUIRED_MESSAGE,
  isBaseMainnetSwitchRejected,
} from "@/lib/wallet/ensureBaseMainnet";
import { useEffect, useId, useState } from "react";
import type { Address, Hash } from "viem";
import { base } from "viem/chains";
import { useAccount, useChainId, useConfig } from "wagmi";

type ClaimNftModalProps = {
  open: boolean;
  onClose: () => void;
  questStatus: QuestStatus;
  onQuestCompleted: (progress: QuestProgress) => void;
};

type ModalStep = "claim" | "success";

type ClaimSuccessState = {
  contractAddress: Address;
  tokenId: string;
  txHash: Hash;
  chainId: number;
};

/**
 * Claim NFT quest modal — mint BaseQuest Builder Badge and show confirmation.
 */
export default function ClaimNftModal({
  open,
  onClose,
  questStatus,
  onQuestCompleted,
}: ClaimNftModalProps) {
  const titleId = useId();
  const config = useConfig();
  const chainId = useChainId();
  const { address, status: walletStatus } = useAccount();
  const { ensureBaseMainnetReady } = useEnsureBaseMainnet();
  const isWalletConnected = walletStatus === "connected" && Boolean(address);
  const badgeAddress = getBaseQuestBadgeAddress();

  const [step, setStep] = useState<ModalStep>("claim");
  const [isClaiming, setIsClaiming] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState<ClaimSuccessState | null>(null);

  useEffect(() => {
    if (!open) {
      setStep("claim");
      setIsClaiming(false);
      setErrorMessage(null);
      setSuccess(null);
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isClaiming) {
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, isClaiming]);

  async function handleClaim() {
    if (!address || !isWalletConnected || isClaiming) {
      setErrorMessage("Connect your wallet to claim.");
      return;
    }

    if (questStatus === "locked") {
      setErrorMessage("Complete the Deploy Contract quest first.");
      return;
    }

    if (questStatus === "completed") {
      setErrorMessage("You already completed the Claim NFT quest.");
      return;
    }

    setIsClaiming(true);
    setErrorMessage(null);

    try {
      const claimChainId = await ensureBaseMainnetReady();

      const result = await claimBaseQuestBadge({
        config,
        chainId: claimChainId,
        walletAddress: address,
        dataSuffix: DATA_SUFFIX,
      });

      if (!result.ok) {
        setErrorMessage(result.message);
        return;
      }

      const saveResponse = await fetch("/api/nfts/claim/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          wallet: address,
          contractAddress: result.contractAddress,
          tokenId: result.tokenId,
          txHash: result.txHash,
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
        contractAddress: result.contractAddress,
        tokenId: result.tokenId,
        txHash: result.txHash,
        chainId: result.chainId,
      });
      setStep("success");

      if (!saveResponse.ok || !saveJson.success) {
        console.error(
          "[ClaimNftModal] /api/nfts/claim/save failed:",
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
            : "NFT minted onchain, but saving failed.",
        );
        return;
      }

      const completeResponse = await fetch("/api/quests/claim-nft/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          wallet: address,
          contractAddress: result.contractAddress,
          tokenId: result.tokenId,
        }),
      });

      const completeJson = (await completeResponse.json()) as {
        success?: boolean;
        error?: string;
        progress?: QuestProgress;
      };

      if (completeResponse.ok && completeJson.success && completeJson.progress) {
        onQuestCompleted(completeJson.progress);
        return;
      }

      setErrorMessage(
        completeJson.error ||
          "NFT saved, but quest completion failed. Refresh and check progress.",
      );
    } catch (error) {
      if (isBaseMainnetSwitchRejected(error)) {
        setErrorMessage(BASE_MAINNET_REQUIRED_MESSAGE);
      } else {
        console.error("[ClaimNftModal] claim failed:", error);
        setErrorMessage(
          error instanceof Error ? error.message : String(error),
        );
      }
    } finally {
      setIsClaiming(false);
    }
  }

  if (!open) {
    return null;
  }

  const explorerAddressUrl = success
    ? getBaseScanAddressUrl(success.contractAddress, success.chainId)
    : badgeAddress
      ? getBaseScanAddressUrl(badgeAddress, chainId || base.id)
      : null;

  const explorerNftUrl = success
    ? getBaseScanNftUrl(
        success.contractAddress,
        success.tokenId,
        success.chainId,
      )
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
        aria-label="Close claim NFT modal"
        className="absolute inset-0 bg-[#050814]/70 backdrop-blur-sm"
        onClick={() => {
          if (!isClaiming) {
            onClose();
          }
        }}
      />

      <GlassPanel className="relative z-10 w-full max-w-lg p-5 sm:p-6">
        {step === "claim" ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={ui.sectionHeading}>Claim</p>
                <h2
                  id={titleId}
                  className="mt-1.5 font-sans text-xl font-bold tracking-tight text-white sm:text-2xl"
                >
                  Claim NFT
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-white/55">
                  Mint your BaseQuest Builder Badge (BQB) on Base. Each wallet
                  can claim only one NFT.
                </p>
              </div>
              <button
                type="button"
                disabled={isClaiming}
                onClick={onClose}
                className={`${ui.secondaryButton} shrink-0 px-3 py-2 text-xs`}
              >
                Close
              </button>
            </div>

            <div className={`${ui.glassRow} mt-5 space-y-3 p-4`}>
              <div>
                <p className="text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-white/45">
                  NFT
                </p>
                <p className="mt-2 font-sans text-base font-semibold text-white">
                  BaseQuest Builder Badge
                </p>
                <p className="mt-1 text-sm leading-relaxed text-white/55">
                  Symbol: BQB · One mint per wallet
                </p>
              </div>
              {badgeAddress ? (
                <div>
                  <p className="text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-white/45">
                    Contract
                  </p>
                  <p
                    className="mt-1 break-all font-mono text-sm text-cyan-100"
                    title={badgeAddress}
                  >
                    {formatWalletAddress(badgeAddress)}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-rose-300/90">
                  Badge contract address is not configured.
                </p>
              )}
            </div>

            {!isWalletConnected ? (
              <p className="mt-4 text-center text-xs text-rose-300/90">
                Connect your wallet to claim.
              </p>
            ) : null}

            {questStatus === "locked" ? (
              <p className="mt-4 text-center text-xs text-amber-200/80">
                Complete Deploy Contract to unlock this quest.
              </p>
            ) : null}

            {errorMessage ? (
              <p className="mt-4 text-center text-xs text-rose-300/90">
                {errorMessage}
              </p>
            ) : null}

            <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
              {explorerAddressUrl ? (
                <a
                  href={explorerAddressUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${ui.secondaryButton} w-full sm:flex-1`}
                >
                  View contract
                </a>
              ) : null}
              <button
                type="button"
                disabled={
                  isClaiming ||
                  !isWalletConnected ||
                  !badgeAddress ||
                  questStatus !== "available"
                }
                onClick={() => void handleClaim()}
                className={`${
                  isClaiming ||
                  !isWalletConnected ||
                  !badgeAddress ||
                  questStatus !== "available"
                    ? `${ui.secondaryButton} cursor-not-allowed opacity-70`
                    : ui.primaryButton
                } w-full sm:flex-1`}
              >
                {isClaiming
                  ? "Minting…"
                  : questStatus === "completed"
                    ? "Already Completed"
                    : questStatus === "locked"
                      ? "Locked"
                      : "Claim NFT"}
              </button>
            </div>
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
                  NFT Claimed
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-white/55">
                  Your BaseQuest Builder Badge is minted. The Claim NFT quest is
                  complete.
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
                  NFT Contract
                </p>
                <p
                  className="mt-1 break-all font-mono text-sm text-cyan-100"
                  title={success.contractAddress}
                >
                  {formatWalletAddress(success.contractAddress)}
                </p>
                <p className="mt-1 break-all font-mono text-[0.65rem] text-white/40">
                  {success.contractAddress}
                </p>
              </div>
              <div>
                <p className="text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-white/45">
                  Token ID
                </p>
                <p className="mt-1 font-mono text-sm text-white">
                  {success.tokenId}
                </p>
              </div>
              {explorerNftUrl || explorerAddressUrl ? (
                <a
                  href={explorerNftUrl ?? explorerAddressUrl ?? "#"}
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
                +50 XP awarded
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
