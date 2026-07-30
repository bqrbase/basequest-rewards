import GlassPanel from "@/components/GlassPanel";
import { ui } from "@/lib/ui-styles";
import Link from "next/link";

/**
 * Dashboard card — BaseQuest Genesis founding collection.
 */
export default function GenesisCollectionCard() {
  return (
    <GlassPanel className={`h-full ${ui.dashCardPad}`}>
      <div className="flex h-full flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
        <div className="relative mx-auto w-full max-w-[180px] shrink-0 overflow-hidden rounded-2xl border border-cyan-200/25 shadow-[0_16px_36px_rgba(0,82,255,0.22)] sm:mx-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/genesis.png"
            alt="BaseQuest Genesis"
            width={360}
            height={360}
            className="h-auto w-full object-cover"
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col text-center sm:text-left">
          <p className={ui.statLabel}>Collection</p>
          <h3 className="mt-1 font-sans text-lg font-semibold tracking-tight text-white sm:text-xl">
            BaseQuest Genesis
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-white/55">
            The Founding NFT Collection on Base
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wider text-white/50">
              ERC-1155
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wider text-white/50">
              1000 NFTs
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wider text-white/50">
              Base Mainnet
            </span>
          </div>

          <div className="mt-5">
            <Link
              href="/genesis"
              className={`${ui.primaryButton} inline-flex w-full justify-center sm:w-auto`}
            >
              View Collection
            </Link>
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}
