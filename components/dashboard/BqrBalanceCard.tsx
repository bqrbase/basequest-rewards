"use client";

import GlassPanel from "@/components/GlassPanel";
import { useBqrBalance } from "@/hooks/useBqrBalance";
import { BQR_TOKEN } from "@/lib/token/bqr";
import { ui } from "@/lib/ui-styles";
import Link from "next/link";

/**
 * Dashboard card — connected wallet BQR balance on Base Mainnet.
 */
export default function BqrBalanceCard() {
  const balance = useBqrBalance();

  return (
    <GlassPanel className={`h-full ${ui.dashCardPad}`}>
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className={ui.statLabel}>Token</p>
            <h3 className="mt-1 font-sans text-lg font-semibold tracking-tight text-white sm:text-xl">
              BQR Balance
            </h3>
          </div>
          <span className="inline-flex rounded-full border border-cyan-300/25 bg-cyan-500/10 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wider text-cyan-100">
            {BQR_TOKEN.symbol}
          </span>
        </div>

        <div className="mt-5 flex flex-1 flex-col">
          {balance.status === "disconnected" ? (
            <div className="mt-auto">
              <p className="font-sans text-3xl font-bold tabular-nums text-white/35">
                —
              </p>
              <p className="mt-2 text-sm text-white/45">
                Connect a wallet to view your BQR balance.
              </p>
            </div>
          ) : null}

          {balance.status === "loading" ? (
            <div className="mt-auto animate-pulse space-y-3" aria-busy="true">
              <div className="h-9 w-36 rounded bg-white/10" />
              <div className="h-4 w-24 rounded bg-white/10" />
              <div className="h-4 w-28 rounded bg-white/10" />
              <span className="sr-only">Loading BQR balance</span>
            </div>
          ) : null}

          {balance.status === "error" ? (
            <div className="mt-auto">
              <p className="font-sans text-3xl font-bold tabular-nums text-white/50">
                —
              </p>
              <p className="mt-2 text-sm text-amber-100/80">{balance.message}</p>
              <p className="mt-1 text-xs text-white/40">
                RPC unavailable — try again shortly.
              </p>
            </div>
          ) : null}

          {balance.status === "ready" ? (
            <div className="mt-auto">
              <p className="font-sans text-3xl font-bold tabular-nums tracking-tight text-white sm:text-4xl">
                {balance.display}{" "}
                <span className="text-xl font-semibold text-cyan-100 sm:text-2xl">
                  {BQR_TOKEN.symbol}
                </span>
              </p>
              <p className="mt-2 text-sm text-white/50">{BQR_TOKEN.network}</p>
            </div>
          ) : null}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wider text-white/50">
            {BQR_TOKEN.network}
          </span>
          <Link
            href="/token"
            className="text-xs font-semibold text-cyan-200/90 underline-offset-2 hover:underline sm:text-sm"
          >
            Token details
          </Link>
        </div>
      </div>
    </GlassPanel>
  );
}
