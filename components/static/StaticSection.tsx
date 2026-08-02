import GlassPanel from "@/components/GlassPanel";
import { ui } from "@/lib/ui-styles";
import type { ReactNode } from "react";

type StaticSectionProps = {
  title: string;
  children: ReactNode;
};

/**
 * Shared glass content block for static informational pages.
 */
export default function StaticSection({ title, children }: StaticSectionProps) {
  return (
    <section>
      <div className={ui.sectionHeaderWrap}>
        <h2 className={ui.sectionTitle}>{title}</h2>
      </div>
      <GlassPanel className="p-5 sm:p-6">
        <div className="space-y-3 text-sm leading-relaxed text-white/65 sm:text-base sm:leading-7">
          {children}
        </div>
      </GlassPanel>
    </section>
  );
}
