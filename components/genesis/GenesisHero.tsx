import GlassPanel from "@/components/GlassPanel";
import { ui } from "@/lib/ui-styles";
import Image from "next/image";

export default function GenesisHero() {
  return (
    <section className={ui.dashSection}>
      <div className="overflow-hidden rounded-2xl border border-white/10 shadow-[0_16px_40px_rgba(0,0,0,0.28)]">
        <div className="relative aspect-[21/9] w-full sm:aspect-[24/9]">
          <Image
            src="/images/banner.png"
            alt="BaseQuest Genesis collection banner"
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 1024px"
            className="object-cover"
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-[#070b18]/80 via-transparent to-transparent"
          />
        </div>
      </div>

      <GlassPanel className={`mt-4 ${ui.dashCardPad} sm:mt-5 sm:p-8`}>
        <div className="flex flex-col items-center gap-6 text-center sm:gap-8">
          <div className="relative mx-auto w-full max-w-sm">
            <div
              aria-hidden
              className="absolute -inset-5 rounded-[2rem] bg-[radial-gradient(circle,rgba(0,82,255,0.35),rgba(34,211,238,0.1),transparent_70%)] blur-2xl"
            />
            <div className="relative overflow-hidden rounded-2xl border border-cyan-200/25 bg-gradient-to-br from-panel-from/90 via-panel-via/80 to-panel-to/85 shadow-[0_20px_48px_rgba(0,82,255,0.24)]">
              <Image
                src="/images/genesis.png"
                alt="BaseQuest Genesis NFT artwork"
                width={960}
                height={960}
                className="h-auto w-full object-cover"
                priority
              />
            </div>
          </div>

          <div className="max-w-2xl">
            <p className={ui.sectionHeading}>Founding Collection</p>
            <h1 className={ui.pageTitle}>BaseQuest Genesis</h1>
            <p className={`${ui.pageSubtitle} sm:mx-auto`}>
              The Founding NFT Collection on Base
            </p>
          </div>
        </div>
      </GlassPanel>
    </section>
  );
}
