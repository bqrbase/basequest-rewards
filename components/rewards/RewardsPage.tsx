"use client";

import ConnectWalletButton from "@/components/ConnectWalletButton";
import GlassPanel from "@/components/GlassPanel";
import PageShell from "@/components/PageShell";
import { useBqrBalance } from "@/hooks/useBqrBalance";
import { useEnsureBaseMainnet } from "@/hooks/useEnsureBaseMainnet";
import { DATA_SUFFIX } from "@/lib/builderCode";
import {
  claimRewardsDistributor,
  getBaseScanTxUrl,
  getRewardsDistributorAddress,
} from "@/lib/contracts/claim/rewardsDistributor";
import {
  fetchClaimProof,
  fetchPendingRewards,
  type PendingRewardItem,
} from "@/lib/rewards/client";
import { ui } from "@/lib/ui-styles";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { Hash } from "viem";
import { useAccount, useChainId, useConfig } from "wagmi";

type ClaimUiState = {
  key: string;
  status: "idle" | "loading" | "success" | "error";
  message?: string;
  txHash?: Hash;
};

function itemKey(item: PendingRewardItem): string {
  const claim = item.claimable;
  if (claim) {
    return `${claim.onChainCampaignId}:${claim.rewardId}`;
  }
  return `${item.actionId}:${item.actionKey ?? "none"}`;
}

function statusLabel(status: string): string {
  switch (status) {
    case "eligible":
      return "Eligible";
    case "already_claimed":
      return "Claimed";
    case "ineligible":
      return "Locked";
    case "reserved":
      return "Reserved";
    default:
      return status;
  }
}

function statusClass(status: string): string {
  switch (status) {
    case "eligible":
      return "border-cyan-300/35 bg-cyan-500/15 text-cyan-100";
    case "already_claimed":
      return "border-emerald-300/30 bg-emerald-500/15 text-emerald-100";
    case "reserved":
      return "border-violet-300/30 bg-violet-500/15 text-violet-100";
    default:
      return "border-white/12 bg-white/[0.04] text-white/60";
  }
}

function RewardsSkeleton() {
  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {Array.from({ length: 3 }, (_, index) => (
        <div
          key={index}
          className={`${ui.glassCard} min-h-[7.5rem] animate-pulse ${ui.dashCardPad}`}
        />
      ))}
    </div>
  );
}

export default function RewardsPage() {
  const config = useConfig();
  const chainId = useChainId();
  const queryClient = useQueryClient();
  const { address, status: walletStatus } = useAccount();
  const { ensureBaseMainnetReady } = useEnsureBaseMainnet();
  const bqrBalance = useBqrBalance();
  const distributorAddress = getRewardsDistributorAddress();

  const isConnected = walletStatus === "connected" && Boolean(address);
  const wallet = address?.toLowerCase() ?? "";

  const [claimState, setClaimState] = useState<ClaimUiState | null>(null);

  const pendingQuery = useQuery({
    queryKey: ["rewards-pending", wallet],
    queryFn: () => fetchPendingRewards(wallet),
    enabled: Boolean(isConnected && wallet),
    staleTime: 15_000,
    retry: 1,
  });

  const items = pendingQuery.data?.items ?? [];
  const claimableCount = pendingQuery.data?.claimableCount ?? 0;

  async function handleClaim(item: PendingRewardItem) {
    const claimable = item.claimable;
    if (!address || !isConnected || !claimable) {
      return;
    }

    const key = itemKey(item);
    if (claimState?.status === "loading") {
      return;
    }

    if (!distributorAddress) {
      setClaimState({
        key,
        status: "error",
        message:
          "Rewards distributor is not configured (NEXT_PUBLIC_REWARDS_DISTRIBUTOR).",
      });
      return;
    }

    setClaimState({ key, status: "loading", message: "Preparing claim…" });

    try {
      const claimChainId = await ensureBaseMainnetReady();

      setClaimState({
        key,
        status: "loading",
        message: "Fetching Merkle proof…",
      });

      const proof = await fetchClaimProof({
        wallet: address,
        campaignId: claimable.onChainCampaignId,
        rewardId: claimable.rewardId,
      });

      setClaimState({
        key,
        status: "loading",
        message: "Confirm the claim in your wallet…",
      });

      const result = await claimRewardsDistributor({
        config,
        chainId: claimChainId ?? chainId,
        walletAddress: address,
        campaignId: BigInt(proof.campaignId),
        rewardId: proof.rewardId,
        amount: BigInt(proof.amount),
        merkleProof: proof.merkleProof,
        dataSuffix: DATA_SUFFIX,
      });

      if (!result.ok) {
        setClaimState({
          key,
          status: "error",
          message: result.message,
        });
        return;
      }

      setClaimState({
        key,
        status: "success",
        message: `Claimed ${item.amountBqr} BQR`,
        txHash: result.txHash,
      });

      await queryClient.invalidateQueries({
        queryKey: ["rewards-pending", wallet],
      });
      bqrBalance.refetch();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Claim failed. Try again.";
      setClaimState({
        key,
        status: "error",
        message,
      });
    }
  }

  return (
    <PageShell>
      <section className={`${ui.dashSection} text-center sm:text-left`}>
        <p className={ui.sectionHeading}>Rewards</p>
        <h1 className={ui.pageTitle}>Claim BQR</h1>
        <p className={ui.pageSubtitle}>
          Claim Merkle-distributed BaseQuest Rewards to your wallet on Base
          Mainnet.
        </p>
      </section>

      {!isConnected ? (
        <GlassPanel className={`${ui.dashCardPad} text-center sm:p-8`}>
          <p className={ui.messageTitle}>Connect your wallet</p>
          <p className="mt-2 text-sm text-white/45">
            Connect to view pending BQR rewards and claim on-chain.
          </p>
          <div className="mt-5 flex justify-center">
            <ConnectWalletButton
              connectLabel="Connect Wallet"
              connectingLabel="Connecting..."
              buttonClassName={`${ui.primaryButton} min-w-[160px]`}
              disabledClassName={`${ui.secondaryButton} min-w-[160px] opacity-70`}
            />
          </div>
        </GlassPanel>
      ) : null}

      {isConnected ? (
        <section className={ui.dashSection}>
          <div className={ui.gridStats}>
            <GlassPanel className={`min-h-[8.5rem] ${ui.dashCardPad}`}>
              <p className={ui.statLabel}>BQR balance</p>
              <p className="mt-auto pt-3 font-sans text-2xl font-bold tracking-tight text-white tabular-nums">
                {bqrBalance.status === "ready"
                  ? bqrBalance.display
                  : bqrBalance.status === "loading"
                    ? "…"
                    : "—"}
              </p>
            </GlassPanel>
            <GlassPanel className={`min-h-[8.5rem] ${ui.dashCardPad}`}>
              <p className={ui.statLabel}>Claimable now</p>
              <p className="mt-auto pt-3 font-sans text-2xl font-bold tracking-tight text-white tabular-nums">
                {pendingQuery.isLoading
                  ? "…"
                  : (pendingQuery.data?.claimableCount ?? 0)}
              </p>
            </GlassPanel>
            <GlassPanel className={`min-h-[8.5rem] ${ui.dashCardPad}`}>
              <p className={ui.statLabel}>Pending BQR</p>
              <p className="mt-auto pt-3 font-sans text-2xl font-bold tracking-tight text-white tabular-nums">
                {pendingQuery.isLoading
                  ? "…"
                  : (pendingQuery.data?.totalPendingBqr ?? 0)}
              </p>
            </GlassPanel>
            <GlassPanel className={`min-h-[8.5rem] ${ui.dashCardPad}`}>
              <p className={ui.statLabel}>Distributor</p>
              <p className="mt-auto pt-3 font-sans text-sm font-semibold tracking-tight text-white/80 break-all">
                {distributorAddress
                  ? `${distributorAddress.slice(0, 6)}…${distributorAddress.slice(-4)}`
                  : "Not configured"}
              </p>
            </GlassPanel>
          </div>
        </section>
      ) : null}

      {isConnected && pendingQuery.isLoading ? <RewardsSkeleton /> : null}

      {isConnected && pendingQuery.isError ? (
        <GlassPanel className={`${ui.dashCardPad} text-center`}>
          <p className={ui.messageTitle}>Unable to load rewards</p>
          <p className="mt-2 text-sm text-white/45">
            {pendingQuery.error instanceof Error
              ? pendingQuery.error.message
              : "Something went wrong."}
          </p>
          <button
            type="button"
            className={`${ui.secondaryButton} mt-5`}
            onClick={() => void pendingQuery.refetch()}
          >
            Retry
          </button>
        </GlassPanel>
      ) : null}

      {isConnected && pendingQuery.isSuccess ? (
        <section className={ui.dashSection}>
          <div className={ui.sectionHeaderWrap}>
            <p className={ui.sectionHeading}>Available</p>
            <h2 className={ui.sectionTitle}>Your rewards</h2>
          </div>

          {items.length === 0 ? (
            <GlassPanel className={`${ui.dashCardPad} text-center`}>
              <p className={ui.messageTitle}>No rewards yet</p>
              <p className="mt-2 text-sm text-white/45">
                Complete quests and referrals to become eligible for BQR
                rewards.
              </p>
            </GlassPanel>
          ) : (
            <ul className="flex flex-col gap-3 sm:gap-4">
              {items.map((item) => {
                const key = itemKey(item);
                const canClaim = Boolean(
                  item.claimable && !item.claimable.claimedOnChain,
                );
                const state =
                  claimState?.key === key ? claimState : null;
                const isLoading = state?.status === "loading";

                return (
                  <li key={key}>
                    <GlassPanel className={ui.dashCardPad}>
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-sans text-lg font-semibold tracking-tight text-white">
                              {item.label}
                            </h3>
                            <span
                              className={`rounded-full border px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-widest ${statusClass(item.status)}`}
                            >
                              {statusLabel(item.status)}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-white/50">
                            {item.reason}
                          </p>
                          <p className="mt-3 font-sans text-xl font-bold tabular-nums text-white">
                            {item.amountBqr}{" "}
                            <span className="text-sm font-semibold text-cyan-200/80">
                              BQR
                            </span>
                            {item.units > 1 ? (
                              <span className="ml-2 text-xs font-medium text-white/40">
                                × {item.units}
                              </span>
                            ) : null}
                          </p>
                          {item.claimable ? (
                            <p className="mt-1 text-xs text-white/35">
                              Campaign #{item.claimable.onChainCampaignId}
                              {item.actionKey
                                ? ` · ${item.actionKey}`
                                : null}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-44">
                          {canClaim ? (
                            <button
                              type="button"
                              disabled={isLoading || !distributorAddress}
                              onClick={() => void handleClaim(item)}
                              className={`${ui.primaryButton} disabled:cursor-not-allowed disabled:opacity-50`}
                            >
                              {isLoading ? "Claiming…" : "Claim"}
                            </button>
                          ) : (
                            <div
                              className={`${ui.secondaryButton} cursor-default text-center opacity-70`}
                            >
                              {item.status === "already_claimed" ||
                              item.claimable?.claimedOnChain
                                ? "Claimed"
                                : item.status === "eligible"
                                  ? "Awaiting drop"
                                  : "Unavailable"}
                            </div>
                          )}
                        </div>
                      </div>

                      {state?.status === "loading" && state.message ? (
                        <p className="mt-3 text-sm text-cyan-100/80">
                          {state.message}
                        </p>
                      ) : null}

                      {state?.status === "error" && state.message ? (
                        <p
                          className="mt-3 text-sm text-rose-300/90"
                          role="alert"
                        >
                          {state.message}
                        </p>
                      ) : null}

                      {state?.status === "success" ? (
                        <div className="mt-3 rounded-xl border border-emerald-300/25 bg-emerald-500/10 px-3 py-2.5">
                          <p className="text-sm font-medium text-emerald-100">
                            {state.message ?? "Claim successful"}
                          </p>
                          {state.txHash ? (
                            <a
                              href={getBaseScanTxUrl(state.txHash)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 inline-block break-all text-xs font-medium text-cyan-200 underline-offset-2 hover:underline"
                            >
                              {state.txHash}
                            </a>
                          ) : null}
                        </div>
                      ) : null}
                    </GlassPanel>
                  </li>
                );
              })}
            </ul>
          )}

          {claimableCount === 0 && items.length > 0 ? (
            <p className="mt-4 text-center text-xs text-white/35 sm:text-left">
              Eligible rewards appear as claimable after a published Merkle
              campaign includes your wallet.
            </p>
          ) : null}
        </section>
      ) : null}
    </PageShell>
  );
}
