import GlassPanel from "@/components/GlassPanel";
import AnimatedCounter from "@/components/ui/AnimatedCounter";
import { ui } from "@/lib/ui-styles";
import type { ReactNode } from "react";

type ProfileStatCardProps = {
  label: string;
  value: string | number | null | undefined;
  hint?: string;
  accentClassName?: string;
  children?: ReactNode;
  format?: (n: number) => string;
};

export default function ProfileStatCard({
  label,
  value,
  hint,
  accentClassName = "text-white",
  children,
  format,
}: ProfileStatCardProps) {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value)
        ? Number(value)
        : null;
  const display =
    value === null || value === undefined || value === ""
      ? "—"
      : value;

  return (
    <GlassPanel className={`h-full ${ui.dashCardPad}`}>
      <p className={ui.statLabel}>{label}</p>
      {children ? (
        <div className="mt-auto flex flex-1 flex-col pt-3">{children}</div>
      ) : (
        <p
          className={`mt-auto pt-3 font-sans text-2xl font-bold tabular-nums tracking-tight sm:text-3xl ${accentClassName}`}
        >
          {numeric !== null && Number.isFinite(numeric) ? (
            <AnimatedCounter
              value={numeric}
              format={format ?? ((n) => n.toLocaleString())}
            />
          ) : (
            display
          )}
        </p>
      )}
      {hint ? (
        <p className="mt-2 text-xs text-white/40">{hint}</p>
      ) : null}
    </GlassPanel>
  );
}
