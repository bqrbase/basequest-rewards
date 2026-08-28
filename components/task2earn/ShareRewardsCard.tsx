"use client";

import {
  confirmSharePoolClaimRequest,
  fetchShareRewardsCampaign,
  verifyDailyShareRewardRequest,
} from "@/lib/task2earn/client";
import { claimBqrShareReward } from "@/lib/contracts/claim/bqrShareRewardsPool";
import { walletsMatch } from "@/lib/task2earn/share-pool-flow";
import {
  formatShareRewardCountdown,
  applyOnChainShareRewardCooldown,
  buildShareRewardsCampaign,
  campaignAfterSuccessfulClaim,
} from "@/lib/task2earn/share-rewards-display";
import type { ShareRewardsCampaign } from "@/lib/task2earn/share-rewards-display";
import {
  canonicalShareRewardsUrl,
  farcasterComposeUrl,
  shareRewardsCastText,
} from "@/lib/miniapp/share";
import { useWalletHost } from "@/lib/wallet/WalletHostContext";
import { Gift, Share2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { getAddress } from "viem";
import { useAccount, useChainId, useConfig } from "wagmi";

async function openShareCastComposer(
  text: string,
  embedUrl: string,
): Promise<{ openedInMiniApp: boolean; hash: string | null }> {
  try {
    const { sdk } = await import("@farcaster/miniapp-sdk");
    const inMiniApp = await sdk.isInMiniApp();
    if (!inMiniApp) {
      return { openedInMiniApp: false, hash: null };
    }
    if (typeof sdk.actions.composeCast === "function") {
      const embeds: [string] = [embedUrl];
      const result = (await sdk.actions.composeCast({
        text,
        embeds,
      })) as { cast?: { hash?: string } | null } | undefined;
      const hash =
        typeof result?.cast?.hash === "string" && result.cast.hash.trim()
          ? result.cast.hash.trim()
          : null;
      return { openedInMiniApp: true, hash };
    }
    await sdk.actions.openUrl(farcasterComposeUrl(text, embedUrl));
    return { openedInMiniApp: true, hash: null };
  } catch {
    return { openedInMiniApp: false, hash: null };
  }
}

function shareMessage(error: string): string {
  switch (error) {
    case "farcaster_required":
      return "Connect a Farcaster-linked wallet to verify this share.";
    case "valid_wallet_required":
      return "Connect a wallet to unlock today's BQR reward.";
    case "pool_depleted":
      return "The BQR reward pool is too low right now. Check back after it is replenished.";
    case "missing_cast":
      return "No matching share was found yet. Publish the cast, then verify.";
    case "wrong_author":
      return "That cast is not from the Farcaster account linked to this wallet.";
    case "reply":
      return "Replies do not count. Publish an original cast with the Mini App embed.";
    case "recast_or_quote":
      return "Recasts and quotes do not count. Publish an original cast.";
    case "listing_url":
      return "Share the BaseQuest Rewards Mini App, not only the /tasks listing.";
    case "url_in_text_only":
      return "The Mini App URL must be an embed, not only mentioned in the text.";
    case "wrong_task_url":
      return "The cast must embed the BaseQuest Rewards Mini App.";
    case "stale_cast":
      return "That cast is too old. Share again, then verify within 24 hours.";
    case "unfetchable":
      return "The cast could not be fetched. Try again after publishing.";
    default:
      return "Share was not verified. No BQR was awarded.";
  }
}

function formatBqr(value: number): string {
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} BQR`;
}

export default function ShareRewardsCard() {
  const { address, status } = useAccount();
  const config = useConfig();
  const chainId = useChainId();
  const walletHost = useWalletHost();
  const farcasterWallet = walletHost === "farcaster";
  const wallet = status === "connected" && address ? address : null;
  const [campaign, setCampaign] = useState<ShareRewardsCampaign>(() =>
    buildShareRewardsCampaign({
      creditedPoolBqr: 0,
      earnedBqr: 0,
      lastCreditedAt: null,
    }),
  );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await fetchShareRewardsCampaign(wallet);
      setCampaign(next);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to load BQR Rewards",
      );
    } finally {
      setLoading(false);
    }
  }, [wallet]);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  const verifyShare = useCallback(
    async (castHash?: string | null) => {
      if (!wallet) {
        setMessage("Connect a wallet to unlock today's BQR reward.");
        return;
      }
      setBusy(true);
      try {
        const result = await verifyDailyShareRewardRequest(wallet, castHash);
        setCampaign(result.campaign);
        if (result.campaign.claimable) {
          setMessage(
            "Share verified. Claim 25 BQR from your Farcaster wallet. You pay Base gas.",
          );
          return;
        }
        if (result.alreadyClaimed) {
          setMessage("Already claimed today. Come back when the 24-hour window resets.");
          return;
        }
        if (result.verified && !result.campaign.claimable) {
          setMessage(
            "Share verified, but on-chain authorization did not complete. Try Verify again in a moment.",
          );
          return;
        }
        if (result.verified) {
          setMessage(
            "Share verified. Claim 25 BQR from your Farcaster wallet. You pay Base gas.",
          );
        }
      } catch (error) {
        setMessage(
          shareMessage(error instanceof Error ? error.message : "proof_failed"),
        );
      } finally {
        setBusy(false);
      }
    },
    [wallet],
  );

  const onShare = useCallback(async () => {
    setMessage(null);
    if (!wallet) {
      setMessage("Connect a wallet to unlock today's BQR reward.");
      return;
    }
    const composed = await openShareCastComposer(
      shareRewardsCastText(),
      canonicalShareRewardsUrl(),
    );
    if (!composed.openedInMiniApp) {
      window.open(
        farcasterComposeUrl(
          shareRewardsCastText(),
          canonicalShareRewardsUrl(),
        ),
        "_blank",
        "noopener,noreferrer",
      );
      setMessage(
        "Publish the cast, then tap Verify share. Opening the composer does not award BQR.",
      );
      return;
    }
    if (composed.hash) {
      await verifyShare(composed.hash);
      return;
    }
    setMessage(
      "Publish the cast, then tap Verify share. Opening the composer does not award BQR.",
    );
  }, [verifyShare, wallet]);

  const onClaim = useCallback(async () => {
    if (!wallet) {
      setMessage("Connect a wallet to claim 25 BQR.");
      return;
    }
    if (!farcasterWallet) {
      setMessage("Open this Mini App in Farcaster to claim. Claim uses the Farcaster wallet only.");
      return;
    }
    if (campaign.claimedToday) {
      setMessage("Already claimed. Come back when the 24-hour window resets.");
      return;
    }
    if (
      !campaign.claimable ||
      !campaign.claimFid ||
      !campaign.claimCastHash ||
      !campaign.qualifiedWallet
    ) {
      setMessage("Verify a share before claiming.");
      return;
    }
    if (!walletsMatch(wallet, campaign.qualifiedWallet)) {
      setMessage("Connect the same wallet that verified this share.");
      return;
    }
    setBusy(true);
    setMessage("Confirm the claim in your Farcaster wallet. You pay Base gas.");
    try {
      const result = await claimBqrShareReward({
        config,
        chainId,
        walletAddress: getAddress(wallet),
        fid: campaign.claimFid,
        castHash: campaign.claimCastHash,
        qualifiedWallet: getAddress(campaign.qualifiedWallet),
        ...(campaign.claimPoolAddress
          ? { contractAddress: getAddress(campaign.claimPoolAddress) }
          : {}),
      });
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setCampaign(campaignAfterSuccessfulClaim(campaign));
      setMessage("Claimed 25 BQR. The payout went to your Farcaster wallet.");
      try {
        const confirmed = await confirmSharePoolClaimRequest(
          wallet,
          result.txHash,
        );
        setCampaign((current) =>
          current.claimedToday && confirmed.campaign.claimable
            ? applyOnChainShareRewardCooldown(
                confirmed.campaign,
                current.nextEligibleAt,
              )
            : confirmed.campaign,
        );
      } catch {
        try {
          const fresh = await fetchShareRewardsCampaign(wallet);
          setCampaign((current) =>
            current.claimedToday && fresh.claimable
              ? applyOnChainShareRewardCooldown(fresh, current.nextEligibleAt)
              : fresh,
          );
        } catch {
          // Keep the local claimed state from the successful receipt.
        }
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Claim failed. No BQR was marked paid.",
      );
    } finally {
      setBusy(false);
    }
  }, [campaign, chainId, config, farcasterWallet, wallet]);

  const live = campaign.live;
  const claimed = campaign.claimedToday;
  const claimable = campaign.claimable && !claimed;
  const ctaDisabled = busy || loading || !live || (claimed && !claimable);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-amber-300/20 bg-[linear-gradient(180deg,rgba(28,22,12,0.94),rgba(10,12,28,0.96))] p-3.5 shadow-[0_12px_28px_rgba(0,0,0,0.35)]">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-10 size-28 rounded-full bg-amber-400/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-8 bottom-0 size-24 rounded-full bg-violet-600/20 blur-3xl"
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-amber-300/25 bg-amber-500/15 text-amber-100">
            <Gift className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="font-sans text-base font-bold text-white">
              BQR Share Rewards
            </h2>
            <p className="text-[0.72rem] text-white/50">
              Free · Daily · Instant reward
            </p>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.58rem] font-bold uppercase tracking-wide ${
            live
              ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
              : "border-white/10 bg-white/5 text-white/45"
          }`}
        >
          <span
            className={`size-1.5 rounded-full ${live ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" : "bg-white/30"}`}
          />
          {live ? "LIVE" : "Paused"}
        </span>
      </div>

      <div className="relative mt-3 rounded-xl border border-amber-300/15 bg-black/30 px-3 py-3">
        <p className="whitespace-pre-line text-[0.8rem] leading-relaxed text-white/90">
          {shareRewardsCastText()}
        </p>
      </div>

      <div className="relative mt-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2.5">
        <p className="text-[0.58rem] font-bold uppercase tracking-[0.16em] text-white/40">
          Your reward today
        </p>
        {claimed && campaign.nextEligibleAt ? (
          <div className="mt-1">
            <p className="font-sans text-lg font-bold text-emerald-100">
              Claimed
            </p>
            <p className="text-[0.72rem] text-white/50">
              Next eligible in {formatShareRewardCountdown(campaign.nextEligibleAt)}
            </p>
          </div>
        ) : claimable ? (
          <p className="mt-1 font-sans text-lg font-bold text-amber-50">
            Ready to claim {formatBqr(campaign.dailyRewardBqr)}
          </p>
        ) : (
          <p className="mt-1 font-sans text-lg font-bold text-amber-50">
            {formatBqr(campaign.dailyRewardBqr)}
          </p>
        )}
      </div>

      {claimable ? (
        <button
          type="button"
          onClick={() => void onClaim()}
          disabled={busy || !wallet || !farcasterWallet || claimed}
          className="relative mt-3 inline-flex min-h-12 w-full items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-base-blue text-[0.78rem] font-bold uppercase tracking-[0.12em] text-white shadow-[0_10px_24px_rgba(124,58,237,0.4)] disabled:opacity-50"
        >
          {busy
            ? "Claiming…"
            : !farcasterWallet
              ? "Open in Farcaster to claim"
              : "Claim 25 BQR"}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void onShare()}
          disabled={ctaDisabled && Boolean(wallet)}
          className="relative mt-3 inline-flex min-h-12 w-full items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-base-blue text-[0.78rem] font-bold uppercase tracking-[0.12em] text-white shadow-[0_10px_24px_rgba(124,58,237,0.4)] disabled:opacity-50"
        >
          <Share2 className="size-4 shrink-0" aria-hidden />
          {!wallet
            ? "Connect to share"
            : claimed
              ? "Come back in 24h"
              : !live
                ? "Pool empty"
                : busy
                  ? "Working…"
                  : "Share and Unlock Rewards"}
        </button>
      )}
      {wallet && !claimed && !claimable ? (
        <button
          type="button"
          onClick={() => void verifyShare()}
          disabled={busy || !live}
          className="relative mt-2 inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-amber-300/30 bg-amber-500/10 text-[0.7rem] font-semibold uppercase tracking-wide text-amber-100 disabled:opacity-50"
        >
          {busy ? "Verifying…" : "Verify share"}
        </button>
      ) : null}

      <ol className="relative mt-3 space-y-1.5 text-[0.72rem] text-white/55">
        <li>1. Share on Farcaster</li>
        <li>2. Verify the share</li>
        <li>3. Claim 25 BQR from your Farcaster wallet (you pay Base gas)</li>
      </ol>

      <p className="relative mt-3 text-[0.65rem] leading-relaxed text-white/40">
        Rewards are paid on-chain once every 24 hours. A successful claim sends
        25 BQR to the Farcaster Mini App wallet.
        {` Pool ${formatBqr(campaign.poolRemainingBqr)} remaining of ${formatBqr(campaign.poolConfiguredBqr)}.`}
      </p>
      {message ? (
        <p className="relative mt-2 text-[0.7rem] text-cyan-100/85" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
