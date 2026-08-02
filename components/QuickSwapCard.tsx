"use client";

import ConnectWalletButton from "@/components/ConnectWalletButton";
import GlassPanel from "@/components/GlassPanel";
import QuestCompletedToast, {
  type QuestCompletedToastData,
} from "@/components/QuestCompletedToast";
import { useEnsureBaseMainnet } from "@/hooks/useEnsureBaseMainnet";
import { useWalletAuth } from "@/hooks/useWalletAuth";
import { requestQuestCompletion } from "@/lib/quests/requestQuestCompletion";
import type { QuestProgress } from "@/lib/quest-engine";
import {
  formatPriceImpact,
  formatTokenAmount,
  formatUsd,
  parseSwapAmount,
} from "@/lib/swap/format";
import {
  executeBaseSwapQuote,
  extractSwapTxHash,
  fetchBaseSwapQuote,
  getQuoteGasUsd,
  getQuotePriceImpactPercent,
  getQuoteToolLabel,
} from "@/lib/swap/lifi";
import { BASE_SWAP_TOKENS, getSwapToken } from "@/lib/swap/tokens";
import {
  BASE_MAINNET_REQUIRED_MESSAGE,
  isBaseMainnetSwitchRejected,
} from "@/lib/wallet/ensureBaseMainnet";
import { ui } from "@/lib/ui-styles";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { parseUnits, type Hash } from "viem";
import { base } from "viem/chains";
import { useAccount, useConfig } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";

const fieldClassName =
  "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-cyan-300/35 focus:bg-white/[0.06] disabled:opacity-60 sm:py-3";

type SwapStatus = "idle" | "submitting" | "success" | "error";

type QuickSwapCardProps = {
  /** Apply verified first-swap quest progress from the server. */
  onFirstSwapQuestCompleted?: (progress: QuestProgress) => void;
};

/**
 * Dashboard Quick Swap card — LI.FI quotes + execution on Base Mainnet.
 */
export default function QuickSwapCard({
  onFirstSwapQuestCompleted,
}: QuickSwapCardProps = {}) {
  const config = useConfig();
  const { address, status: walletStatus } = useAccount();
  const { ensureBaseMainnetReady } = useEnsureBaseMainnet();
  const { ensureWalletAuth } = useWalletAuth();

  const isWalletConnected = walletStatus === "connected" && Boolean(address);

  const [fromSymbol, setFromSymbol] = useState("ETH");
  const [toSymbol, setToSymbol] = useState("USDC");
  const [amount, setAmount] = useState("0.01");
  const [debouncedAmountUnits, setDebouncedAmountUnits] = useState<string | null>(
    null,
  );

  const [swapStatus, setSwapStatus] = useState<SwapStatus>("idle");
  const [swapError, setSwapError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [executionHint, setExecutionHint] = useState<string | null>(null);
  const [questToast, setQuestToast] = useState<QuestCompletedToastData | null>(
    null,
  );

  const fromToken = getSwapToken(fromSymbol) ?? BASE_SWAP_TOKENS[0];
  const toToken = getSwapToken(toSymbol) ?? BASE_SWAP_TOKENS[1];
  const amountValue = parseSwapAmount(amount);

  const amountBaseUnits = useMemo(() => {
    if (
      amountValue === null ||
      amountValue <= 0 ||
      !fromToken ||
      fromSymbol === toSymbol
    ) {
      return null;
    }
    try {
      return parseUnits(amount.trim(), fromToken.decimals).toString();
    } catch {
      return null;
    }
  }, [amount, amountValue, fromToken, fromSymbol, toSymbol]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedAmountUnits(amountBaseUnits);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [amountBaseUnits]);

  const quoteEnabled = Boolean(
    isWalletConnected &&
      address &&
      debouncedAmountUnits &&
      fromToken &&
      toToken &&
      fromSymbol !== toSymbol,
  );

  const quoteQuery = useQuery({
    queryKey: [
      "lifi-base-quote",
      address,
      fromToken?.address,
      toToken?.address,
      debouncedAmountUnits,
    ],
    enabled: quoteEnabled,
    staleTime: 20_000,
    retry: 1,
    queryFn: async () => {
      if (!address || !fromToken || !toToken || !debouncedAmountUnits) {
        throw new Error("Missing quote parameters.");
      }
      return fetchBaseSwapQuote({
        fromToken: fromToken.address,
        toToken: toToken.address,
        fromAmount: debouncedAmountUnits,
        fromAddress: address,
      });
    },
  });

  const quote = quoteQuery.data ?? null;
  const quoteLoading = quoteEnabled && (quoteQuery.isFetching || quoteQuery.isPending);
  const quoteError =
    quoteQuery.error instanceof Error
      ? quoteQuery.error.message
      : quoteQuery.error
        ? "Could not fetch a swap quote."
        : null;

  const route = quote ? getQuoteToolLabel(quote) : null;
  const estimatedOutput =
    quote && toToken
      ? formatTokenAmount(quote.estimate.toAmount, toToken.decimals)
      : null;
  const networkFeeUsd = quote ? getQuoteGasUsd(quote) : null;
  const priceImpact = quote ? getQuotePriceImpactPercent(quote) : null;

  const canSwap =
    isWalletConnected &&
    Boolean(quote) &&
    !quoteLoading &&
    !quoteError &&
    swapStatus !== "submitting";

  function swapDirection() {
    setFromSymbol(toSymbol);
    setToSymbol(fromSymbol);
    setSwapStatus("idle");
    setSwapError(null);
    setTxHash(null);
  }

  async function completeFirstSwapQuest(confirmedTxHash: string) {
    if (!address || !onFirstSwapQuestCompleted) {
      return;
    }

    const result = await requestQuestCompletion({
      endpoint: "/api/quests/first-swap/complete",
      body: {
        wallet: address,
        txHash: confirmedTxHash,
      },
      ensureAuth: ensureWalletAuth,
    });

    if (!result.success || !result.progress) {
      console.error("[QuickSwapCard] first-swap complete failed:", result.error);
      return;
    }

    onFirstSwapQuestCompleted(result.progress);

    if (!result.alreadyCompleted) {
      setQuestToast({
        title: "Complete your first swap",
        rewardXp: 25,
        emoji: "🎉",
      });
    }
  }

  async function handleSwap() {
    if (!quote || !address || swapStatus === "submitting") {
      return;
    }

    setSwapStatus("submitting");
    setSwapError(null);
    setTxHash(null);
    setExecutionHint("Confirm in your wallet…");

    try {
      await ensureBaseMainnetReady();

      const executed = await executeBaseSwapQuote({
        wagmiConfig: config,
        quote,
        onUpdate: (routeUpdate) => {
          const hash = extractSwapTxHash(routeUpdate);
          if (hash) {
            setTxHash(hash);
            setExecutionHint(
              "Transaction submitted. Waiting for confirmation…",
            );
          }
        },
      });

      const hash = extractSwapTxHash(executed);
      if (!hash) {
        throw new Error("Swap finished without a transaction hash.");
      }

      setTxHash(hash);
      setExecutionHint("Confirming transaction on Base…");

      const receipt = await waitForTransactionReceipt(config, {
        hash: hash as Hash,
        chainId: base.id,
        confirmations: 1,
      });

      if (receipt.status !== "success") {
        throw new Error("Swap transaction reverted on Base.");
      }

      setSwapStatus("success");
      setExecutionHint(null);

      await completeFirstSwapQuest(hash);
    } catch (error) {
      if (isBaseMainnetSwitchRejected(error)) {
        setSwapError(BASE_MAINNET_REQUIRED_MESSAGE);
      } else {
        setSwapError(
          error instanceof Error ? error.message : "Swap failed. Try again.",
        );
      }
      setSwapStatus("error");
      setExecutionHint(null);
    }
  }

  return (
    <>
    <QuestCompletedToast
      toast={questToast}
      onDismiss={() => setQuestToast(null)}
    />
    <div id="quick-swap" className="flex h-full min-h-0 scroll-mt-24 flex-col">
    <GlassPanel className={`h-full ${ui.dashCardPad}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className={ui.statLabel}>Trade</p>
          <p className="mt-1 font-sans text-lg font-semibold tracking-tight text-white sm:text-xl">
            Quick Swap
          </p>
        </div>
        <span className="inline-flex w-fit rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wider text-white/50">
          Base · LI.FI
        </span>
      </div>

      <div className="mt-4 flex flex-1 flex-col space-y-3 sm:mt-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end sm:gap-3">
          <label className="block min-w-0">
            <span className={ui.statLabel}>From</span>
            <select
              value={fromSymbol}
              onChange={(event) => {
                setFromSymbol(event.target.value);
                setSwapStatus("idle");
                setSwapError(null);
                setTxHash(null);
              }}
              className={`${fieldClassName} mt-2 appearance-none`}
              aria-label="From token"
              disabled={swapStatus === "submitting"}
            >
              {BASE_SWAP_TOKENS.map((token) => (
                <option
                  key={token.symbol}
                  value={token.symbol}
                  className="bg-[#0b1024] text-white"
                >
                  {token.symbol} — {token.name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex justify-center sm:pb-1">
            <button
              type="button"
              onClick={swapDirection}
              disabled={swapStatus === "submitting"}
              className="inline-flex size-11 items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] text-cyan-100/90 transition-all duration-300 hover:border-cyan-300/30 hover:bg-white/[0.08] disabled:opacity-50"
              aria-label="Swap token direction"
            >
              <span className="text-base sm:hidden" aria-hidden>
                ↕
              </span>
              <span className="hidden text-base sm:inline" aria-hidden>
                ↔
              </span>
            </button>
          </div>

          <label className="block min-w-0">
            <span className={ui.statLabel}>To</span>
            <select
              value={toSymbol}
              onChange={(event) => {
                setToSymbol(event.target.value);
                setSwapStatus("idle");
                setSwapError(null);
                setTxHash(null);
              }}
              className={`${fieldClassName} mt-2 appearance-none`}
              aria-label="To token"
              disabled={swapStatus === "submitting"}
            >
              {BASE_SWAP_TOKENS.map((token) => (
                <option
                  key={token.symbol}
                  value={token.symbol}
                  className="bg-[#0b1024] text-white"
                >
                  {token.symbol} — {token.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className={ui.statLabel}>Amount</span>
          <div className="relative mt-2">
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
                setSwapStatus("idle");
                setSwapError(null);
                setTxHash(null);
              }}
              placeholder="0.0"
              className={`${fieldClassName} pr-16 font-mono tabular-nums`}
              aria-label="Swap amount"
              disabled={swapStatus === "submitting"}
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-semibold text-white/45">
              {fromToken?.symbol}
            </span>
          </div>
        </label>

        <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.05] to-transparent p-3 sm:p-4">
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="min-w-0 col-span-2 sm:col-span-1">
              <p className={ui.statLabel}>Estimated output</p>
              <p className="mt-1.5 truncate font-mono text-lg font-semibold tabular-nums text-white sm:text-xl">
                {quoteLoading
                  ? "Fetching…"
                  : estimatedOutput && toToken
                    ? `${estimatedOutput} ${toToken.symbol}`
                    : "—"}
              </p>
            </div>

            <div className="min-w-0 col-span-2 sm:col-span-1 sm:text-right">
              <p className={ui.statLabel}>Best route</p>
              <p className="mt-1.5 font-sans text-sm font-semibold text-cyan-100/90 sm:text-base">
                {route?.provider ?? "—"}
              </p>
              <p className="mt-1 truncate text-xs text-white/40">
                {route?.label ?? "Waiting for quote"}
              </p>
            </div>

            <div className="min-w-0">
              <p className={ui.statLabel}>Network fee</p>
              <p className="mt-1.5 font-mono text-sm font-semibold tabular-nums text-white/90">
                {formatUsd(networkFeeUsd)}
              </p>
            </div>

            <div className="min-w-0 sm:text-right">
              <p className={ui.statLabel}>Price impact</p>
              <p className="mt-1.5 font-mono text-sm font-semibold tabular-nums text-white/90">
                {formatPriceImpact(priceImpact)}
              </p>
            </div>
          </div>
        </div>

        {!isWalletConnected ? (
          <p className="text-center text-xs text-white/45">
            Connect your wallet to fetch a live Base quote.
          </p>
        ) : null}

        {quoteError ? (
          <p className="text-center text-xs text-rose-300/90">{quoteError}</p>
        ) : null}

        {swapError ? (
          <p className="text-center text-xs text-rose-300/90">{swapError}</p>
        ) : null}

        {executionHint ? (
          <p className="text-center text-xs text-cyan-100/70">{executionHint}</p>
        ) : null}

        {swapStatus === "success" ? (
          <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-2.5 text-center">
            <p className="text-sm font-semibold text-emerald-200">
              Swap successful
            </p>
            {txHash ? (
              <a
                href={`https://basescan.org/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-xs text-cyan-200/90 underline-offset-2 hover:underline"
              >
                View on Basescan
              </a>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-auto border-t border-white/10 pt-4 sm:pt-5">
        {!isWalletConnected ? (
          <ConnectWalletButton
            connectLabel="Connect wallet to swap"
            connectingLabel="Connecting..."
            buttonClassName={`${ui.primaryButton} w-full`}
            disabledClassName={`${ui.secondaryButton} w-full opacity-70`}
          />
        ) : (
          <button
            type="button"
            disabled={!canSwap}
            onClick={() => void handleSwap()}
            className={`${canSwap ? ui.primaryButton : `${ui.primaryButton} cursor-not-allowed opacity-70`} w-full`}
          >
            {swapStatus === "submitting"
              ? "Swapping…"
              : quoteLoading
                ? "Getting quote…"
                : "Swap"}
          </button>
        )}
      </div>
    </GlassPanel>
    </div>
    </>
  );
}
