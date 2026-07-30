import { GENESIS_STATUS_ITEMS } from "@/components/genesis/genesisConfig";
import GlassPanel from "@/components/GlassPanel";
import { ui } from "@/lib/ui-styles";

export default function GenesisStatus() {
  return (
    <section className={ui.dashSection}>
      <GlassPanel className={ui.dashCardPad}>
        <p className={ui.statLabel}>Live Collection Status</p>
        <ul className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
          {GENESIS_STATUS_ITEMS.map((item) => (
            <li
              key={item}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/25 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-100"
            >
              <span aria-hidden>✅</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </GlassPanel>
    </section>
  );
}
