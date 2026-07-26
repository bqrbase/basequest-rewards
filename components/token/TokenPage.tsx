"use client";

import GlassPanel from "@/components/GlassPanel";
import PageShell from "@/components/PageShell";
import { BQR_TOKEN, getBqrExplorerUrl } from "@/lib/token/bqr";
import { formatWalletAddress, ui } from "@/lib/ui-styles";
import Image from "next/image";
import { useState } from "react";

const TOKEN_FACTS = [
  { label: "Token Name", value: BQR_TOKEN.name },
  { label: "Symbol", value: BQR_TOKEN.symbol },
  { label: "Network", value: BQR_TOKEN.network },
  { label: "Total Supply", value: BQR_TOKEN.totalSupply },
] as const;

export default function TokenPage() {
  const [copied, setCopied] = useState(false);
  const explorerUrl = getBqrExplorerUrl();

  async function handleCopyContract() {
    try {
      await navigator.clipboard.writeText(BQR_TOKEN.contractAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <PageShell>
      <section className={`${ui.dashSection} text-center sm:text-left`}>
        <p className={ui.sectionHeading}>Token</p>
        <h1 className={ui.pageTitle}>BaseQuest Rewards</h1>
        <p className={ui.pageSubtitle}>
          Official BQR token details on Base Mainnet.
        </p>
      </section>

      <section className={ui.dashSection}>
        <GlassPanel className={ui.dashCardPad}>
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start sm:gap-6">
            <div className="relative mx-auto flex size-24 shrink-0 items-center justify-center sm:mx-0 sm:size-28">
              <div
                aria-hidden
                className="absolute -inset-2 rounded-full bg-[radial-gradient(circle,rgba(0,82,255,0.45),rgba(34,211,238,0.15),transparent_70%)] blur-md"
              />
              <div className="relative overflow-hidden rounded-full border border-cyan-200/30 bg-gradient-to-br from-base-blue via-indigo-600 to-violet-700 shadow-[0_0_28px_rgba(0,82,255,0.4)]">
                <Image
                  src="/app-icon.png"
                  alt="BaseQuest Rewards (BQR) logo"
                  width={112}
                  height={112}
                  className="size-24 object-cover sm:size-28"
                  priority
                />
              </div>
            </div>

            <div className="min-w-0 flex-1 text-center sm:text-left">
              <p className={ui.statLabel}>Official token</p>
              <h2 className="mt-1 font-sans text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {BQR_TOKEN.name}
              </h2>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <span className="rounded-full border border-cyan-300/35 bg-cyan-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-cyan-100">
                  {BQR_TOKEN.symbol}
                </span>
                <span className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-xs font-semibold uppercase tracking-widest text-white/70">
                  {BQR_TOKEN.network}
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-white/55">
                Total supply{" "}
                <span className="font-semibold tabular-nums text-white">
                  {BQR_TOKEN.totalSupply}
                </span>{" "}
                BQR on Base.
              </p>
            </div>
          </div>
        </GlassPanel>
      </section>

      <section className={ui.dashSection}>
        <div className={ui.sectionHeaderWrap}>
          <p className={ui.sectionHeading}>Details</p>
          <h2 className={ui.sectionTitle}>Token Information</h2>
        </div>

        <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 sm:gap-4">
          {TOKEN_FACTS.map((fact) => (
            <GlassPanel key={fact.label} className={`h-full ${ui.dashCardPad}`}>
              <p className={ui.statLabel}>{fact.label}</p>
              <p className="mt-auto pt-3 font-sans text-xl font-bold tracking-tight text-white sm:text-2xl">
                {fact.value}
              </p>
            </GlassPanel>
          ))}
        </div>
      </section>

      <section className={ui.dashSection}>
        <div className={ui.sectionHeaderWrap}>
          <p className={ui.sectionHeading}>Contract</p>
          <h2 className={ui.sectionTitle}>Onchain Address</h2>
        </div>

        <GlassPanel className={ui.dashCardPad}>
          <p className={ui.statLabel}>Contract Address</p>
          <p
            className="mt-2 break-all font-mono text-sm font-semibold tracking-wide text-white sm:text-base"
            title={BQR_TOKEN.contractAddress}
          >
            <span className="sm:hidden">
              {formatWalletAddress(BQR_TOKEN.contractAddress)}
            </span>
            <span className="hidden sm:inline">
              {BQR_TOKEN.contractAddress}
            </span>
          </p>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => void handleCopyContract()}
              aria-live="polite"
              className={`${copied ? ui.primaryButton : ui.secondaryButton} w-full sm:flex-1`}
            >
              {copied ? "Copied!" : "Copy Contract"}
            </button>
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${ui.primaryButton} w-full text-center sm:flex-1`}
            >
              View on Explorer
            </a>
          </div>
        </GlassPanel>
      </section>
    </PageShell>
  );
}
