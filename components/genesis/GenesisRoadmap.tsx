import { GENESIS_ROADMAP } from "@/components/genesis/genesisConfig";
import GlassPanel from "@/components/GlassPanel";
import { ui } from "@/lib/ui-styles";

export default function GenesisRoadmap() {
  return (
    <section className={ui.dashSection}>
      <div className={ui.sectionHeaderWrap}>
        <p className={ui.sectionHeading}>Roadmap</p>
        <h2 className={ui.sectionTitle}>What’s Next</h2>
        <p className={ui.sectionDescription}>
          From deployment to holder utilities and future rewards.
        </p>
      </div>

      <GlassPanel className={`${ui.dashCardPad} sm:p-6`}>
        <ol className="relative space-y-0">
          {GENESIS_ROADMAP.map((item, index) => {
            const complete = item.status === "complete";
            const isLast = index === GENESIS_ROADMAP.length - 1;

            return (
              <li key={item.title} className="relative flex gap-4 pb-6 last:pb-0">
                {!isLast ? (
                  <span
                    aria-hidden
                    className="absolute left-[15px] top-8 h-[calc(100%-1.25rem)] w-px bg-white/10"
                  />
                ) : null}

                <span
                  className={`relative z-10 mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                    complete
                      ? "border-emerald-300/35 bg-emerald-500/15 text-emerald-200"
                      : "border-white/12 bg-white/[0.04] text-white/55"
                  }`}
                >
                  {complete ? "✓" : index + 1}
                </span>

                <div className={`${ui.glassRow} min-w-0 flex-1 px-3 py-3 sm:px-4`}>
                  <p className="font-sans text-sm font-semibold text-white sm:text-base">
                    {item.title}
                  </p>
                  <p className="mt-0.5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-white/40">
                    {complete ? "Completed" : "Upcoming"}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </GlassPanel>
    </section>
  );
}
