import { GENESIS_WHY_HOLD } from "@/components/genesis/genesisConfig";
import GlassPanel from "@/components/GlassPanel";
import { ui } from "@/lib/ui-styles";
import {
  BadgeCheck,
  Gift,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";

const ICONS = {
  badge: BadgeCheck,
  gift: Gift,
  users: Users,
  zap: Zap,
  trending: TrendingUp,
  sparkles: Sparkles,
} as const;

export default function GenesisBenefits() {
  return (
    <section className={ui.dashSection}>
      <div className={ui.sectionHeaderWrap}>
        <p className={ui.sectionHeading}>Holders</p>
        <h2 className={ui.sectionTitle}>Why Hold Genesis</h2>
        <p className={ui.sectionDescription}>
          Genesis ownership is designed for long-term BaseQuest participation.
        </p>
      </div>

      <div className={ui.gridCards}>
        {GENESIS_WHY_HOLD.map((benefit) => {
          const Icon = ICONS[benefit.icon];

          return (
            <GlassPanel
              key={benefit.title}
              className={`h-full ${ui.dashCardPad}`}
            >
              <div className="flex h-full flex-col gap-3 text-left">
                <span className="inline-flex size-10 items-center justify-center rounded-xl border border-cyan-300/25 bg-cyan-500/10 text-cyan-100">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div>
                  <h3 className="font-sans text-base font-semibold text-white sm:text-lg">
                    {benefit.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/55">
                    {benefit.description}
                  </p>
                </div>
              </div>
            </GlassPanel>
          );
        })}
      </div>
    </section>
  );
}
