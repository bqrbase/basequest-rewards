import { ui } from "@/lib/ui-styles";
import type { ReactNode } from "react";

type GlassPanelProps = {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  secondary?: boolean;
  as?: "article" | "div" | "section";
  role?: string;
  "aria-live"?: "polite" | "assertive" | "off";
};

/**
 * Shared glass surface with Wallet Score panel glow + sheen.
 */
export default function GlassPanel({
  children,
  className = "",
  interactive = false,
  secondary = false,
  as: Tag = "article",
  role,
  "aria-live": ariaLive,
}: GlassPanelProps) {
  const surface = secondary
    ? ui.glassCardSecondary
    : interactive
      ? ui.glassCardInteractive
      : ui.glassCard;

  return (
    <Tag
      className={`flex flex-col ${surface} ${className}`}
      role={role}
      aria-live={ariaLive}
    >
      <div aria-hidden className={ui.panelGlow} />
      <div aria-hidden className={ui.panelSheen} />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">{children}</div>
    </Tag>
  );
}
