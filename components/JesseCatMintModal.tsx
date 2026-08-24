"use client";

import GlassPanel from "@/components/GlassPanel";
import { useEnsureBaseMainnet } from "@/hooks/useEnsureBaseMainnet";
import { readApiJson } from "@/lib/jessecat/readApiJson";
import {
  getJesseCatBaseScanTxUrl,
  JESSECAT_CONTRACT_ADDRESS,
  JESSECAT_OPENSEA_URL,
} from "@/lib/jessecat/config";
import { formatWalletAddress, ui } from "@/lib/ui-styles";
import {
  BASE_MAINNET_REQUIRED_MESSAGE,
  isBaseMainnetSwitchRejected,
} from "@/lib/wallet/ensureBaseMainnet";
import type { QuestProgress } from "@/lib/quest-engine";
import { executeCalls } from "@/lib/wallet/TransactionManager";
import { useWalletHost } from "@/lib/wallet/WalletHostContext";
import { useEffect, useId, useMemo, useState } from "react";
import { type Address, type Hash, type Hex } from "viem";
import { useAccount, useConfig } from "wagmi";

type JesseCatMintModalProps = {
  open: boolean;
  onClose: () => void;
  onCompleted?: (progress: QuestProgress) => void;
};

type ModalStep = "mint" | "success";

type DropStage = {
  label: string | null;
  price: string | null;
  maxPerWallet: number | null;
  startTime: string | null;
  endTime: string | null;
};

type DropSummary = {
  collectionName: string | null;
  totalSupply: string | null;
  maxSupply: string | null;
  remaining: number | null;
  stages: DropStage[];
};

type MintApiSuccess = {
  success: true;
  to: Address;
  data: Hex;
  value: string;
  quantity: number;
};

function resolveMaxQuantity(drop: DropSummary | null): number {
  if (!drop) {
    return 10;
  }
  const stageCaps = drop.stages
    .map((stage) => stage.maxPerWallet)
    .filter((value): value is number => typeof value === "number" && value > 0);
  const stageMax = stageCaps.length > 0 ? Math.min(...stageCaps) : 10;
  const remainingCap =
    typeof drop.remaining === "number" && drop.remaining > 0
      ? drop.remaining
      : stageMax;
  return Math.max(1, Math.min(100, stageMax, remainingCap));
}

/**
 * JesseCat mint modal — OpenSea builds calldata; user wallet sends on Base.
 */
export default function JesseCatMintModal({
  open,
  onClose,
  onCompleted,
}: JesseCatMintModalProps) {
  const titleId = useId();
  const config = useConfig();
  const host = useWalletHost();
  const { address, status: walletStatus } = useAccount();
  const { ensureBaseMainnetReady } = useEnsureBaseMainnet();
  const isWalletConnected = walletStatus === "connected" && Boolean(address);

  const [step, setStep] = useState<ModalStep>("mint");
  const [quantity, setQuantity] = useState(1);
  const [drop, setDrop] = useState<DropSummary | null>(null);
  const [dropError, setDropError] = useState<string | null>(null);
  const [dropLoading, setDropLoading] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<Hash | null>(null);

  const maxQuantity = useMemo(() => resolveMaxQuantity(drop), [drop]);

  useEffect(() => {
    if (!open) {
      setStep("mint");
      setQuantity(1);
      setDrop(null);
      setDropError(null);
      setDropLoading(false);
      setIsMinting(false);
      setErrorMessage(null);
      setTxHash(null);
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isMinting) {
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);

    let cancelled = false;
    setDropLoading(true);
    setDropError(null);

    void (async () => {
      try {
        const response = await fetch("/api/jessecat/drop", {
          method: "GET",
          credentials: "include",
        });
        const parsed = await readApiJson<{
          success?: boolean;
          drop?: DropSummary;
          message?: string;
          error?: string;
        }>(response, "Unable to load JesseCat drop details.");
        if (cancelled) {
          return;
        }
        if (!parsed.ok || !parsed.json?.success || !parsed.json.drop) {
          setDropError(parsed.message);
          return;
        }
        setDrop(parsed.json.drop);
      } catch (error) {
        if (!cancelled) {
          setDropError(
            error instanceof Error
              ? error.message
              : "Unable to load JesseCat drop details.",
          );
        }
      } finally {
        if (!cancelled) {
          setDropLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, isMinting]);

  useEffect(() => {
    if (quantity > maxQuantity) {
      setQuantity(maxQuantity);
    }
  }, [maxQuantity, quantity]);

  const publicStagePrice = drop?.stages.find(
    (stage) =>
      stage.price &&
      (!stage.label || /public/i.test(stage.label) || stage.label.length > 0),
  )?.price;

  async function handleMint() {
    if (!address || !isWalletConnected || isMinting) {
      setErrorMessage("Connect your wallet to mint JesseCat.");
      return;
    }

    setIsMinting(true);
    setErrorMessage(null);

    try {
      await ensureBaseMainnetReady();

      const response = await fetch("/api/jessecat/mint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          minter: address,
          quantity,
        }),
      });

      const parsed = await readApiJson<MintApiSuccess & {
        success?: boolean;
        message?: string;
        error?: string;
      }>(
        response,
        "OpenSea could not build the JesseCat mint transaction.",
      );

      if (
        !parsed.ok ||
        !parsed.json?.success ||
        !parsed.json.to ||
        !parsed.json.data ||
        !parsed.json.value
      ) {
        setErrorMessage(parsed.message);
        return;
      }

      const json = parsed.json;
      const valueWei = BigInt(json.value);
      const result = await executeCalls({
        config,
        host,
        calls: [
          {
            to: json.to,
            data: json.data,
            value: valueWei,
          },
        ],
      });

      if (!result.hash) {
        setErrorMessage("Mint submitted but no transaction hash was returned.");
        return;
      }

      const completeResponse = await fetch(
        "/api/quests/jessecat-mint/complete",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            wallet: address,
            txHash: result.hash,
          }),
        },
      );

      const completeParsed = await readApiJson<{
        success?: boolean;
        progress?: QuestProgress;
        error?: string;
        message?: string;
      }>(
        completeResponse,
        "Mint confirmed, but XP sync returned an invalid response.",
      );

      if (!completeParsed.ok || !completeParsed.json?.success) {
        const verificationFailed =
          completeParsed.json?.error === "tx_reverted" ||
          completeParsed.json?.error === "receipt_not_found" ||
          completeParsed.json?.error === "invalid_tx_hash" ||
          completeParsed.json?.error === "contract_mismatch";
        if (verificationFailed) {
          setErrorMessage(
            completeParsed.message ||
              "JesseCat mint could not be confirmed on Base.",
          );
          return;
        }

        console.error("[JesseCatMintModal] jessecat-mint complete failed:", {
          status: completeParsed.status,
          contentType: completeParsed.contentType,
          error: completeParsed.json?.error,
          message: completeParsed.message,
        });
      } else if (completeParsed.json.progress) {
        onCompleted?.(completeParsed.json.progress);
      }

      setTxHash(result.hash);
      setStep("success");
    } catch (error) {
      if (isBaseMainnetSwitchRejected(error)) {
        setErrorMessage(BASE_MAINNET_REQUIRED_MESSAGE);
      } else {
        console.error("[JesseCatMintModal] mint failed:", error);
        setErrorMessage(
          error instanceof Error ? error.message : String(error),
        );
      }
    } finally {
      setIsMinting(false);
    }
  }

  if (!open) {
    return null;
  }

  const basescanUrl = txHash ? getJesseCatBaseScanTxUrl(txHash) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        aria-label="Close JesseCat mint modal"
        className="absolute inset-0 bg-[#050814]/70 backdrop-blur-sm"
        onClick={() => {
          if (!isMinting) {
            onClose();
          }
        }}
      />

      <GlassPanel className="relative z-10 w-full max-w-lg p-5 sm:p-6">
        {step === "mint" ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={ui.sectionHeading}>Collection</p>
                <h2
                  id={titleId}
                  className="mt-1.5 font-sans text-xl font-bold tracking-tight text-white sm:text-2xl"
                >
                  Mint JesseCat
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-white/55">
                  Mint on Base via the official OpenSea Drop. Price and limits
                  come from OpenSea — same contract and supply as OpenSea.
                </p>
              </div>
              <button
                type="button"
                disabled={isMinting}
                onClick={onClose}
                className={`${ui.secondaryButton} shrink-0 px-3 py-2 text-xs`}
              >
                Close
              </button>
            </div>

            <div className={`${ui.glassRow} mt-5 space-y-3 p-4`}>
              <div>
                <p className="text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-white/45">
                  Contract
                </p>
                <p
                  className="mt-1 break-all font-mono text-sm text-cyan-100"
                  title={JESSECAT_CONTRACT_ADDRESS}
                >
                  {formatWalletAddress(JESSECAT_CONTRACT_ADDRESS)}
                </p>
              </div>
              {dropLoading ? (
                <p className="text-xs text-white/55">Loading drop details…</p>
              ) : dropError ? (
                <p className="text-xs text-amber-200/80">{dropError}</p>
              ) : drop ? (
                <>
                  <div className="flex flex-wrap gap-3 text-xs text-white/60">
                    {drop.remaining !== null ? (
                      <span>Remaining: {drop.remaining}</span>
                    ) : null}
                    {drop.totalSupply && drop.maxSupply ? (
                      <span>
                        Supply: {drop.totalSupply} / {drop.maxSupply}
                      </span>
                    ) : null}
                    {publicStagePrice ? (
                      <span>Stage price: {publicStagePrice}</span>
                    ) : null}
                  </div>
                  <label className="block text-xs text-white/70">
                    Quantity
                    <select
                      className="mt-1.5 w-full rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2 text-sm text-white"
                      value={quantity}
                      disabled={isMinting}
                      onChange={(event) =>
                        setQuantity(Number(event.target.value))
                      }
                    >
                      {Array.from({ length: maxQuantity }, (_, index) => {
                        const value = index + 1;
                        return (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                </>
              ) : null}
            </div>

            {!isWalletConnected ? (
              <p className="mt-4 text-center text-xs text-rose-300/90">
                Connect your wallet to mint.
              </p>
            ) : null}

            {errorMessage ? (
              <p className="mt-4 text-center text-xs text-rose-300/90">
                {errorMessage}
              </p>
            ) : null}

            <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
              <a
                href={JESSECAT_OPENSEA_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={`${ui.secondaryButton} w-full sm:flex-1`}
              >
                View on OpenSea
              </a>
              <button
                type="button"
                disabled={!isWalletConnected || isMinting || dropLoading}
                onClick={() => void handleMint()}
                className={`${ui.primaryButton} w-full sm:flex-1`}
              >
                {isMinting ? "Minting…" : "Mint JesseCat"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={ui.sectionHeading}>Success</p>
                <h2
                  id={titleId}
                  className="mt-1.5 font-sans text-xl font-bold tracking-tight text-white sm:text-2xl"
                >
                  JesseCat minted
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-white/55">
                  Your mint transaction was submitted on Base Mainnet.
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

            {txHash ? (
              <div className={`${ui.glassRow} mt-5 space-y-2 p-4`}>
                <p className="text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-white/45">
                  Transaction
                </p>
                <p className="break-all font-mono text-xs text-cyan-100">
                  {txHash}
                </p>
              </div>
            ) : null}

            <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
              {basescanUrl ? (
                <a
                  href={basescanUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${ui.secondaryButton} w-full sm:flex-1`}
                >
                  View on BaseScan
                </a>
              ) : null}
              <a
                href={JESSECAT_OPENSEA_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={`${ui.primaryButton} w-full sm:flex-1`}
              >
                View on OpenSea
              </a>
            </div>
          </>
        )}
      </GlassPanel>
    </div>
  );
}
