"use client";

import GlassPanel from "@/components/GlassPanel";
import { DATA_SUFFIX } from "@/lib/builderCode";
import {
  deployHelloBase,
  getBaseScanAddressUrl,
} from "@/lib/contracts/deploy/helloBase";
import { useEnsureBaseMainnet } from "@/hooks/useEnsureBaseMainnet";
import type { QuestProgress, QuestStatus } from "@/lib/quest-engine";
import { formatWalletAddress, ui } from "@/lib/ui-styles";
import {
  BASE_MAINNET_REQUIRED_MESSAGE,
  isBaseMainnetSwitchRejected,
} from "@/lib/wallet/ensureBaseMainnet";
import { useEffect, useId, useState } from "react";
import type { Address, Hash } from "viem";
import { useAccount, useConfig } from "wagmi";

export type DeployContractTemplateId =
  | "hello-base"
  | "storage"
  | "erc20";

type DeployContractTemplate = {
  id: DeployContractTemplateId;
  title: string;
  description: string;
  enabled: boolean;
};

const TEMPLATES: DeployContractTemplate[] = [
  {
    id: "hello-base",
    title: "Hello Base",
    description: "A simple starter contract to deploy your first contract on Base.",
    enabled: true,
  },
  {
    id: "storage",
    title: "Storage Contract",
    description: "Store and update a value onchain.",
    enabled: false,
  },
  {
    id: "erc20",
    title: "ERC20 Token",
    description: "Deploy a basic ERC20 token on Base.",
    enabled: false,
  },
];

type DeployContractModalProps = {
  open: boolean;
  onClose: () => void;
  questStatus: QuestStatus;
  onQuestCompleted: (progress: QuestProgress) => void;
};

type ModalStep = "templates" | "hello-base" | "success";

type DeploySuccessState = {
  contractAddress: Address;
  txHash: Hash;
  chainId: number;
};

/**
 * Deploy Contract quest modal — template picker + Hello Base deploy flow.
 */
export default function DeployContractModal({
  open,
  onClose,
  questStatus,
  onQuestCompleted,
}: DeployContractModalProps) {
  const titleId = useId();
  const config = useConfig();
  const { address, status: walletStatus } = useAccount();
  const { ensureBaseMainnetReady } = useEnsureBaseMainnet();
  const isWalletConnected = walletStatus === "connected" && Boolean(address);

  const [step, setStep] = useState<ModalStep>("templates");
  const [isDeploying, setIsDeploying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState<DeploySuccessState | null>(null);

  useEffect(() => {
    if (!open) {
      setStep("templates");
      setIsDeploying(false);
      setErrorMessage(null);
      setSuccess(null);
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isDeploying) {
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, isDeploying]);

  async function handleDeploy() {
    if (!address || !isWalletConnected || isDeploying) {
      setErrorMessage("Connect your wallet to deploy.");
      return;
    }

    if (questStatus === "completed") {
      setErrorMessage("You already completed the Deploy Contract quest.");
      return;
    }

    setIsDeploying(true);
    setErrorMessage(null);

    try {
      const deployChainId = await ensureBaseMainnetReady();

      const result = await deployHelloBase({
        config,
        chainId: deployChainId,
        dataSuffix: DATA_SUFFIX,
      });

      if (!result.ok) {
        setErrorMessage(result.message);
        return;
      }

      const saveResponse = await fetch("/api/contracts/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          wallet: address,
          contractAddress: result.contractAddress,
          txHash: result.txHash,
          chainId: result.chainId,
          templateId: "hello-base",
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
        txHash: result.txHash,
        chainId: result.chainId,
      });
      setStep("success");

      if (!saveResponse.ok || !saveJson.success) {
        console.error(
          "[DeployContractModal] /api/contracts/save failed:",
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
            : "Contract deployed onchain, but saving failed.",
        );
        return;
      }

      const completeResponse = await fetch(
        "/api/quests/deploy-contract/complete",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            wallet: address,
            contractAddress: result.contractAddress,
          }),
        },
      );

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
          "Contract saved, but quest completion failed. Refresh and check progress.",
      );
    } catch (error) {
      if (isBaseMainnetSwitchRejected(error)) {
        setErrorMessage(BASE_MAINNET_REQUIRED_MESSAGE);
      } else {
        console.error("[DeployContractModal] deploy failed:", error);
        setErrorMessage(
          error instanceof Error ? error.message : String(error),
        );
      }
    } finally {
      setIsDeploying(false);
    }
  }

  if (!open) {
    return null;
  }

  const explorerUrl = success
    ? getBaseScanAddressUrl(success.contractAddress, success.chainId)
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
        aria-label="Close deploy contract modal"
        className="absolute inset-0 bg-[#050814]/70 backdrop-blur-sm"
        onClick={() => {
          if (!isDeploying) {
            onClose();
          }
        }}
      />

      <GlassPanel className="relative z-10 w-full max-w-lg p-5 sm:p-6">
        {step === "templates" ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={ui.sectionHeading}>Deploy</p>
                <h2
                  id={titleId}
                  className="mt-1.5 font-sans text-xl font-bold tracking-tight text-white sm:text-2xl"
                >
                  Deploy Contract
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-white/55">
                  Choose a contract template to continue.
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

            <div className="mt-5 space-y-3">
              {TEMPLATES.map((template) => {
                if (!template.enabled) {
                  return (
                    <div
                      key={template.id}
                      className={`${ui.glassRow} flex cursor-not-allowed items-start justify-between gap-3 p-4 opacity-60`}
                    >
                      <div className="min-w-0">
                        <p className="font-sans text-sm font-semibold text-white sm:text-base">
                          {template.title}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-white/45 sm:text-sm">
                          {template.description}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-badge border border-white/12 bg-white/[0.04] px-2.5 py-1 text-[0.6rem] font-semibold uppercase tracking-widest text-white/55">
                        Coming Soon
                      </span>
                    </div>
                  );
                }

                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => {
                      setErrorMessage(null);
                      setStep("hello-base");
                    }}
                    className={`${ui.glassRow} flex w-full items-start justify-between gap-3 p-4 text-left`}
                  >
                    <div className="min-w-0">
                      <p className="font-sans text-sm font-semibold text-white sm:text-base">
                        {template.title}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-white/55 sm:text-sm">
                        {template.description}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-badge border border-cyan-300/40 bg-cyan-500/15 px-2.5 py-1 text-[0.6rem] font-semibold uppercase tracking-widest text-cyan-100">
                      Available
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        ) : null}

        {step === "hello-base" ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={ui.sectionHeading}>Hello Base</p>
                <h2
                  id={titleId}
                  className="mt-1.5 font-sans text-xl font-bold tracking-tight text-white sm:text-2xl"
                >
                  Deployment Flow
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-white/55">
                  Deploy the Hello Base contract with your connected wallet on
                  Base.
                </p>
              </div>
              <button
                type="button"
                disabled={isDeploying}
                onClick={onClose}
                className={`${ui.secondaryButton} shrink-0 px-3 py-2 text-xs`}
              >
                Close
              </button>
            </div>

            <div className={`${ui.glassRow} mt-5 p-4`}>
              <p className="text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-white/45">
                Template
              </p>
              <p className="mt-2 font-sans text-base font-semibold text-white">
                Hello Base
              </p>
              <p className="mt-1 text-sm leading-relaxed text-white/55">
                message = &quot;Built on BaseQuest Rewards&quot;
              </p>
            </div>

            {!isWalletConnected ? (
              <p className="mt-4 text-center text-xs text-rose-300/90">
                Connect your wallet to deploy.
              </p>
            ) : null}

            {errorMessage ? (
              <p className="mt-4 text-center text-xs text-rose-300/90">
                {errorMessage}
              </p>
            ) : null}

            <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
              <button
                type="button"
                disabled={isDeploying}
                onClick={() => {
                  setErrorMessage(null);
                  setStep("templates");
                }}
                className={`${ui.secondaryButton} w-full sm:flex-1`}
              >
                Back to templates
              </button>
              <button
                type="button"
                disabled={
                  isDeploying ||
                  !isWalletConnected ||
                  questStatus === "completed"
                }
                onClick={() => void handleDeploy()}
                className={`${
                  isDeploying ||
                  !isWalletConnected ||
                  questStatus === "completed"
                    ? `${ui.secondaryButton} cursor-not-allowed opacity-70`
                    : ui.primaryButton
                } w-full sm:flex-1`}
              >
                {isDeploying
                  ? "Deploying…"
                  : questStatus === "completed"
                    ? "Already Completed"
                    : "Deploy"}
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
                  Contract Deployed
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-white/55">
                  Hello Base is live on Base. Your Deploy Contract quest is
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
                  Contract Address
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
