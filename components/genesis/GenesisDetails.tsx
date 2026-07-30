import { GENESIS_DETAILS } from "@/components/genesis/genesisConfig";
import GlassPanel from "@/components/GlassPanel";
import { ui } from "@/lib/ui-styles";

export default function GenesisDetails() {
  return (
    <section className={ui.dashSection}>
      <div className={ui.sectionHeaderWrap}>
        <p className={ui.sectionHeading}>Details</p>
        <h2 className={ui.sectionTitle}>Collection Details</h2>
        <p className={ui.sectionDescription}>
          A clear snapshot of the live Genesis collection parameters.
        </p>
      </div>

      <GlassPanel className={ui.dashCardPad}>
        <dl className="divide-y divide-white/10">
          {GENESIS_DETAILS.map((detail) => (
            <div
              key={detail.label}
              className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:py-3.5"
            >
              <dt className={ui.statLabel}>{detail.label}</dt>
              <dd className="font-sans text-sm font-semibold text-white sm:text-base">
                {detail.value}
              </dd>
            </div>
          ))}
        </dl>
      </GlassPanel>
    </section>
  );
}
