import { ui } from "@/lib/ui-styles";

export default function ProfileSkeleton() {
  return (
    <div className="flex flex-col gap-8 sm:gap-10 md:gap-12">
      <section className={`${ui.dashSection} animate-pulse`}>
        <div className={`${ui.glassCard} ${ui.dashCardPad}`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="mx-auto size-20 shrink-0 rounded-full bg-white/10 sm:mx-0 sm:size-24" />
            <div className="flex-1 space-y-3">
              <div className="mx-auto h-6 w-40 rounded bg-white/10 sm:mx-0" />
              <div className="mx-auto h-4 w-32 rounded bg-white/10 sm:mx-0" />
              <div className="h-2.5 w-full rounded-full bg-white/10" />
            </div>
          </div>
        </div>
      </section>

      <section className={`${ui.dashSection} ${ui.gridStats}`}>
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className={`${ui.glassCard} min-h-[9rem] animate-pulse ${ui.dashCardPad}`}
          >
            <div className="h-3 w-20 rounded bg-white/10" />
            <div className="mt-6 h-8 w-14 rounded bg-white/10" />
          </div>
        ))}
      </section>

      <section className={`${ui.dashSection} grid grid-cols-2 gap-3 sm:grid-cols-4`}>
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className={`${ui.glassCard} min-h-[7rem] animate-pulse ${ui.dashCardPad}`}
          />
        ))}
      </section>

      <section className={`${ui.dashSection} grid grid-cols-2 gap-3 sm:grid-cols-4`}>
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className={`${ui.glassCard} min-h-[8rem] animate-pulse ${ui.dashCardPad}`}
          />
        ))}
      </section>
    </div>
  );
}
