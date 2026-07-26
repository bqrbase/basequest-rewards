"use client";

import ConnectWalletButton from "@/components/ConnectWalletButton";
import GlassPanel from "@/components/GlassPanel";
import QuestCompletedToast, {
  type QuestCompletedToastData,
} from "@/components/QuestCompletedToast";
import { requestQuestCompletion } from "@/lib/quests/requestQuestCompletion";
import type { QuestProgress } from "@/lib/quest-engine";
import {
  BRIDGE_DEST_CHAIN_ID,
  BRIDGE_SOURCE_CHAINS,
  getBridgeSourceChain,
  getBridgeToken,
  getBridgeTokensForChain,
  resolveBaseReceiveToken,
  type BridgeSourceChainId,
} from "@/lib/swap/bridge";
import {
  BridgeSettlementError,
  createPendingBridgeSettlement,
  getBridgeStatusLabel,
  runBridgeToBase,
  type BridgeSettlement,
  type BridgeStatus,
} from "@/lib/swap/bridgeSettlement";
import {
  formatTokenAmount,
  formatUsd,
  parseSwapAmount,
} from "@/lib/swap/format";
import {
  fetchBridgeToBaseQuote,
  getQuoteNetworkFeeUsd,
  getQuoteToolLabel,
} from "@/lib/swap/lifi";
import { ui } from "@/lib/ui-styles";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { parseUnits } from "viem";
import { useAccount, useConfig, useSwitchChain } from "wagmi";

type BridgeToBaseCardProps = {
  /** Apply verified bridge-to-base quest progress from the server. */
  onBridgeQuestCompleted?: (progress: QuestProgress) => void;
};

const fieldClassName =
  "w-full rounded-xl border border-white/12 bg-black/20 px-3 py-3 text-sm text-white outline-none transition-colors focus:border-cyan-300/35 focus:bg-black/30 disabled:opacity-60";

function isBusyStatus(status: BridgeStatus): boolean {
  return status === "bridging" || status === "waiting_destination";
}

function failureMessage(error: unknown): string {
  if (error instanceof BridgeSettlementError) {
    switch (error.reason) {
      case "rejected":
        return "Transaction was rejected in your wallet.";
      case "cancelled":
        return "Bridge cancelled.";
      case "timeout":
        return "Timed out waiting for Base confirmation.";
      case "destination_failed":
        return "Destination transaction failed on Base.";
      case "route_failed":
        return error.message || "Bridge route failed.";
      default:
        return error.message || "Bridge failed. Try again.";
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Bridge failed. Try again.";
}

/**
 * Dashboard Bridge to Base card — LI.FI cross-chain quotes + execution.
 * Success only after destination settlement (LI.FI DONE or Base dest confirm).
 */
export default function BridgeToBaseCard({
  onBridgeQuestCompleted,
}: BridgeToBaseCardProps = {}) {
  const config = useConfig();
  const { address, status: walletStatus } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const abortRef = useRef<AbortController | null>(null);

  const isWalletConnected = walletStatus === "connected" && Boolean(address);

  const [sourceChainId, setSourceChainId] = useState<BridgeSourceChainId>(
    BRIDGE_SOURCE_CHAINS[0].id,
  );
  const [tokenSymbol, setTokenSymbol] = useState(
    getBridgeTokensForChain(BRIDGE_SOURCE_CHAINS[0].id)[0]?.symbol ?? "ETH",
  );
  const [amount, setAmount] = useState("0.01");
  const [debouncedAmountUnits, setDebouncedAmountUnits] = useState<string | null>(
    null,
  );

  const [settlement, setSettlement] = useState<BridgeSettlement>(() =>
    createPendingBridgeSettlement(BRIDGE_SOURCE_CHAINS[0].id),
  );
  const [bridgeError, setBridgeError] = useState<string | null>(null);
  const [questToast, setQuestToast] = useState<QuestCompletedToastData | null>(
    null,
  );

  const {
    sourceTxHash,
    destinationTxHash,
    sourceChainId: settlementSourceChainId,
    destinationChainId,
    bridgeStatus,
  } = settlement;

  const sourceChain =
    getBridgeSourceChain(settlementSourceChainId) ??
    getBridgeSourceChain(sourceChainId)!;
  const sourceTokens = getBridgeTokensForChain(sourceChainId);
  const fromToken =
    getBridgeToken(sourceChainId, tokenSymbol) ?? sourceTokens[0];
  const toToken = fromToken ? resolveBaseReceiveToken(fromToken) : null;
  const amountValue = parseSwapAmount(amount);
  const busy = isBusyStatus(bridgeStatus);

  let amountBaseUnits: string | null = null;
  if (amountValue !== null && amountValue > 0 && fromToken) {
    try {
      amountBaseUnits = parseUnits(amount.trim(), fromToken.decimals).toString();
    } catch {
      amountBaseUnits = null;
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedAmountUnits(amountBaseUnits);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [amountBaseUnits]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const quoteEnabled = Boolean(
    isWalletConnected &&
      address &&
      debouncedAmountUnits &&
      fromToken &&
      toToken,
  );

  const quoteQuery = useQuery({
    queryKey: [
      "lifi-bridge-to-base-quote",
      address,
      sourceChainId,
      fromToken?.address,
      toToken?.address,
      debouncedAmountUnits,
    ],
    enabled: quoteEnabled,
    staleTime: 20_000,
    retry: 1,
    queryFn: async () => {
      if (!address || !fromToken || !toToken || !debouncedAmountUnits) {
        throw new Error("Missing bridge quote parameters.");
      }
      return fetchBridgeToBaseQuote({
        fromChain: sourceChainId,
        fromToken: fromToken.address,
        toToken: toToken.address,
        fromAmount: debouncedAmountUnits,
        fromAddress: address,
      });
    },
  });

  const quote = quoteQuery.data ?? null;
  const quoteLoading =
    quoteEnabled && (quoteQuery.isFetching || quoteQuery.isPending);
  const quoteError =
    quoteQuery.error instanceof Error
      ? quoteQuery.error.message
      : quoteQuery.error
        ? "Could not fetch a bridge quote."
        : null;

  const route = quote ? getQuoteToolLabel(quote) : null;
  const receiveDecimals =
    quote?.action?.toToken?.decimals ?? toToken?.decimals ?? 18;
  const receiveSymbol =
    quote?.action?.toToken?.symbol ?? toToken?.symbol ?? "ETH";
  const estimatedReceived =
    quote?.estimate?.toAmount != null
      ? formatTokenAmount(quote.estimate.toAmount, receiveDecimals)
      : null;
  const networkFeeUsd = quote ? getQuoteNetworkFeeUsd(quote) : null;

  const canBridge =
    isWalletConnected &&
    Boolean(quote) &&
    !quoteLoading &&
    !quoteError &&
    !busy;

  function resetSettlement(nextSourceChainId = sourceChainId) {
    abortRef.current?.abort();
    abortRef.current = null;
    setSettlement(createPendingBridgeSettlement(nextSourceChainId));
    setBridgeError(null);
  }

  function handleCancel() {
    abortRef.current?.abort();
  }

  async function completeBridgeQuest(completed: BridgeSettlement) {
    if (!address || !onBridgeQuestCompleted) {
      return;
    }

    // Quest gating: only after destination settlement — never earlier statuses.
    if (completed.bridgeStatus !== "completed") {
      return;
    }
    if (!completed.destinationTxHash) {
      return;
    }
    if (completed.destinationChainId !== BRIDGE_DEST_CHAIN_ID) {
      return;
    }

    const result = await requestQuestCompletion({
      endpoint: "/api/quests/bridge-to-base/complete",
      body: {
        wallet: address,
        bridgeStatus: completed.bridgeStatus,
        destinationTxHash: completed.destinationTxHash,
        destinationChainId: completed.destinationChainId,
        sourceTxHash: completed.sourceTxHash,
      },
    });

    if (!result.success || !result.progress) {
      console.error(
        "[BridgeToBaseCard] bridge-to-base complete failed:",
        result.error,
      );
      return;
    }

    onBridgeQuestCompleted(result.progress);

    if (!result.alreadyCompleted) {
      setQuestToast({
        title: "Bridge assets to Base",
        rewardXp: 30,
        emoji: "🌉",
      });
    }
  }

  async function handleBridge() {
    if (!quote || !address || !fromToken || busy) {
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setBridgeError(null);
    setSettlement({
      sourceTxHash: null,
      destinationTxHash: null,
      sourceChainId,
      destinationChainId: settlement.destinationChainId,
      bridgeStatus: "bridging",
    });

    try {
      await switchChainAsync({ chainId: sourceChainId });

      const completed = await runBridgeToBase({
        wagmiConfig: config,
        quote,
        sourceChainId,
        signal: controller.signal,
        onProgress: setSettlement,
      });

      setSettlement(completed);
      await completeBridgeQuest(completed);
    } catch (error) {
      if (error instanceof BridgeSettlementError) {
        setSettlement(error.settlement);
      } else {
        setSettlement((current) => ({
          ...current,
          bridgeStatus: "failed",
          failureReason: "unknown",
        }));
      }
      setBridgeError(failureMessage(error));
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  }

  const showSettlementPanel =
    busy ||
    bridgeStatus === "completed" ||
    (bridgeStatus === "failed" && Boolean(sourceTxHash || destinationTxHash));

  return (
    <>
    <QuestCompletedToast
      toast={questToast}
      onDismiss={() => setQuestToast(null)}
    />
    <div id="bridge-to-base" className="scroll-mt-24">
      <GlassPanel className="p-5 sm:p-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className={ui.statLabel}>Bridge</p>
            <p className="mt-1 font-sans text-lg font-semibold text-white sm:text-xl">
              Bridge to Base
            </p>
          </div>
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <p className="text-xs text-white/40">
              Cross-chain · Powered by LI.FI
            </p>
            <p className="text-xs font-medium text-cyan-100/80">
              {getBridgeStatusLabel(bridgeStatus)}
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-3 sm:mt-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3">
            <label className="block min-w-0">
              <span className={ui.statLabel}>Source chain</span>
              <select
                value={sourceChainId}
                onChange={(event) => {
                  const nextChainId = Number(
                    event.target.value,
                  ) as BridgeSourceChainId;
                  const nextTokens = getBridgeTokensForChain(nextChainId);
                  setSourceChainId(nextChainId);
                  setTokenSymbol(nextTokens[0]?.symbol ?? "ETH");
                  resetSettlement(nextChainId);
                }}
                className={`${fieldClassName} mt-2 appearance-none`}
                aria-label="Source chain"
                disabled={busy}
              >
                {BRIDGE_SOURCE_CHAINS.map((chain) => (
                  <option
                    key={chain.id}
                    value={chain.id}
                    className="bg-[#0b1024] text-white"
                  >
                    {chain.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block min-w-0">
              <span className={ui.statLabel}>Destination chain</span>
              <div
                className={`${fieldClassName} mt-2 cursor-default text-white/90`}
                aria-label="Destination chain"
              >
                Base
                <span className="ml-2 text-xs text-white/40">
                  ({destinationChainId})
                </span>
              </div>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3">
            <label className="block min-w-0">
              <span className={ui.statLabel}>Token</span>
              <select
                value={fromToken?.symbol ?? ""}
                onChange={(event) => {
                  setTokenSymbol(event.target.value);
                  resetSettlement();
                }}
                className={`${fieldClassName} mt-2 appearance-none`}
                aria-label="Bridge token"
                disabled={busy}
              >
                {sourceTokens.map((token) => (
                  <option
                    key={`${token.chainId}-${token.symbol}`}
                    value={token.symbol}
                    className="bg-[#0b1024] text-white"
                  >
                    {token.symbol} — {token.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block min-w-0">
              <span className={ui.statLabel}>Amount</span>
              <div className="relative mt-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => {
                    setAmount(event.target.value);
                    resetSettlement();
                  }}
                  placeholder="0.0"
                  className={`${fieldClassName} pr-16 font-mono tabular-nums`}
                  aria-label="Bridge amount"
                  disabled={busy}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-semibold text-white/45">
                  {fromToken?.symbol}
                </span>
              </div>
            </label>
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3.5 sm:p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              <div className="min-w-0">
                <p className={ui.statLabel}>Estimated received</p>
                <p className="mt-1.5 truncate font-mono text-lg font-semibold tabular-nums text-white sm:text-xl">
                  {quoteLoading
                    ? "Fetching…"
                    : estimatedReceived
                      ? `${estimatedReceived} ${receiveSymbol}`
                      : "—"}
                </p>
                <p className="mt-1 text-xs text-white/40">on Base</p>
              </div>

              <div className="min-w-0 sm:text-right">
                <p className={ui.statLabel}>Route</p>
                <p className="mt-1.5 font-sans text-sm font-semibold text-cyan-100/90 sm:text-base">
                  {route?.provider ?? "—"}
                </p>
                <p className="mt-1 truncate text-xs text-white/40">
                  {route?.label ?? "Waiting for quote"}
                </p>
              </div>

              <div className="min-w-0 sm:col-span-2">
                <p className={ui.statLabel}>Network fee</p>
                <p className="mt-1.5 font-mono text-sm font-semibold tabular-nums text-white/90">
                  {formatUsd(networkFeeUsd)}
                </p>
              </div>
            </div>
          </div>

          {!isWalletConnected ? (
            <p className="text-center text-xs text-white/45">
              Connect your wallet to fetch a live bridge quote.
            </p>
          ) : null}

          {quoteError ? (
            <p className="text-center text-xs text-rose-300/90">{quoteError}</p>
          ) : null}

          {bridgeError ? (
            <p className="text-center text-xs text-rose-300/90">{bridgeError}</p>
          ) : null}

          {bridgeStatus === "pending" ? (
            <p className="text-center text-xs text-white/45">Pending</p>
          ) : null}

          {bridgeStatus === "bridging" ? (
            <p className="text-center text-xs text-cyan-100/70">Bridging…</p>
          ) : null}

          {bridgeStatus === "waiting_destination" ? (
            <p className="text-center text-xs text-cyan-100/70">
              Waiting for Base confirmation…
            </p>
          ) : null}

          {showSettlementPanel ? (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
              <p className={ui.statLabel}>Settlement</p>
              <div className="mt-2 space-y-1.5 text-xs text-white/70">
                <p className="truncate font-mono">
                  sourceTxHash: {sourceTxHash ?? "—"}
                </p>
                <p className="truncate font-mono">
                  destinationTxHash: {destinationTxHash ?? "—"}
                </p>
                <p className="font-mono">
                  sourceChainId: {settlementSourceChainId || sourceChainId}
                </p>
                <p className="font-mono">
                  destinationChainId: {destinationChainId}
                </p>
                <p className="font-mono">bridgeStatus: {bridgeStatus}</p>
              </div>
            </div>
          ) : null}

          {bridgeStatus === "completed" ? (
            <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-2.5 text-center">
              <p className="text-sm font-semibold text-emerald-200">
                Bridge completed ✅
              </p>
              <p className="mt-1 text-xs text-white/55">
                Assets settled on Base
              </p>
              <div className="mt-2 flex flex-col items-center gap-1">
                {sourceTxHash ? (
                  <a
                    href={sourceChain.explorerTxUrl(sourceTxHash)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-cyan-200/90 underline-offset-2 hover:underline"
                  >
                    Source tx on {sourceChain.shortName}
                  </a>
                ) : null}
                {destinationTxHash ? (
                  <a
                    href={`https://basescan.org/tx/${destinationTxHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-cyan-200/90 underline-offset-2 hover:underline"
                  >
                    Destination tx on Basescan
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-5 space-y-3 border-t border-white/10 pt-5 sm:mt-6">
          {!isWalletConnected ? (
            <ConnectWalletButton
              connectLabel="Connect wallet to bridge"
              connectingLabel="Connecting..."
              buttonClassName={`${ui.primaryButton} w-full`}
              disabledClassName={`${ui.secondaryButton} w-full opacity-70`}
            />
          ) : (
            <>
              <button
                type="button"
                disabled={!canBridge}
                onClick={() => void handleBridge()}
                className={`${canBridge ? ui.primaryButton : `${ui.primaryButton} cursor-not-allowed opacity-70`} w-full`}
              >
                {busy
                  ? getBridgeStatusLabel(bridgeStatus)
                  : quoteLoading
                    ? "Getting quote…"
                    : "Bridge to Base"}
              </button>
              {busy ? (
                <button
                  type="button"
                  onClick={handleCancel}
                  className={`${ui.secondaryButton} w-full`}
                >
                  Cancel bridge
                </button>
              ) : null}
            </>
          )}
        </div>
      </GlassPanel>
    </div>
    </>
  );
}
