import {
  GENESIS_IMAGE_URL,
  GENESIS_OPENSEA_URL,
} from "@/components/genesis/genesisConfig";
import GlassPanel from "@/components/GlassPanel";
import { ui } from "@/lib/ui-styles";

export default function GenesisFeaturedNft() {
  return (
    <section className={ui.dashSection}>
      <div className={ui.sectionHeaderWrap}>
        <p className={ui.sectionHeading}>Featured</p>
        <h2 className={ui.sectionTitle}>NFT Preview</h2>
        <p className={ui.sectionDescription}>
          The first Genesis NFT minted from the founding collection.
        </p>
      </div>

      <GlassPanel className={ui.dashCardPad}>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
          <div className="relative mx-auto w-full max-w-[220px] shrink-0 overflow-hidden rounded-2xl border border-cyan-200/25 shadow-[0_16px_36px_rgba(0,82,255,0.22)] sm:mx-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={GENESIS_IMAGE_URL}
              alt="BaseQuest Genesis #1"
              width={440}
              height={440}
              className="h-auto w-full object-cover"
            />
          </div>

          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className={ui.statLabel}>Featured NFT</p>
            <h3 className="mt-1 font-sans text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Genesis #1
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-white/55 sm:text-base">
              The first minted Genesis token — the origin piece of the BaseQuest
              founding collection on Base.
            </p>
            <a
              href={GENESIS_OPENSEA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={`${ui.primaryButton} mt-5 inline-flex w-full justify-center sm:w-auto`}
            >
              View on OpenSea
            </a>
          </div>
        </div>
      </GlassPanel>
    </section>
  );
}
