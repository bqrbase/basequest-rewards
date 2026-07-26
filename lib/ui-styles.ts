/**
 * Shared BaseQuest design system — visual tokens match Base Wallet Score.
 * Prefer these classes over one-off styling so the whole app stays cohesive.
 */
export const ui = {
  pageMain:
    "relative mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 pb-12 pt-3 sm:gap-10 sm:px-6 sm:pb-14 sm:pt-5 md:gap-12 lg:gap-14",

  /** Dashboard section vertical rhythm */
  dashSection: "w-full",

  /** Two-up responsive pair (mobile stack → tablet/desktop equal columns) */
  dashPairGrid:
    "grid grid-cols-1 items-stretch gap-4 sm:gap-4 md:grid-cols-2 md:gap-4 lg:gap-5",

  /** Column cell: header + stretching card */
  dashPairCell: "flex min-h-0 flex-col",

  /** Equal header band so paired card tops align */
  dashPairHeader:
    "mb-3 flex min-h-[4.75rem] flex-col justify-end sm:mb-4 sm:min-h-[5.5rem]",

  /** Taller band when section includes a short description */
  dashPairHeaderTall:
    "mb-3 flex min-h-[6.75rem] flex-col justify-end sm:mb-4 sm:min-h-[7.75rem]",

  /** Card host that fills remaining column height */
  dashPairBody: "flex min-h-0 flex-1 flex-col",

  /** Shared card padding on dashboard surfaces */
  dashCardPad: "p-4 sm:p-5",

  sectionHeading:
    "text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-cyan-100/45",

  sectionTitle:
    "mt-1 font-sans text-xl font-bold tracking-tight text-text-primary sm:mt-1.5 sm:text-2xl lg:text-[1.75rem]",

  pageTitle:
    "mt-1.5 font-sans text-[1.85rem] font-bold leading-[1.1] tracking-tight text-text-primary sm:mt-2 sm:text-4xl sm:leading-tight",

  pageSubtitle:
    "mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-text-muted sm:mx-0 sm:mt-3 sm:text-base sm:leading-7",

  sectionHeaderWrap: "mb-3 sm:mb-4",

  sectionDescription:
    "mt-1.5 line-clamp-2 max-w-2xl text-sm leading-relaxed text-text-muted sm:mt-2 sm:text-base",

  /** Primary glass panel — Wallet Score “primary” surface */
  glassCard:
    "relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-panel-from/85 via-panel-via/78 to-panel-to/80 shadow-[0_16px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl",

  /** Interactive primary panel */
  glassCardInteractive:
    "relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-panel-from/85 via-panel-via/78 to-panel-to/80 shadow-[0_16px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-200/15 hover:shadow-[0_20px_48px_rgba(0,0,0,0.34)]",

  /** Quieter secondary surface */
  glassCardSecondary:
    "relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.03] shadow-[0_8px_24px_rgba(0,0,0,0.2)] backdrop-blur-xl transition-all duration-200 hover:border-white/12 hover:bg-white/[0.045]",

  /** Soft inner row / list cell */
  glassRow:
    "rounded-2xl border border-white/10 bg-white/[0.04] transition-all duration-300 hover:-translate-y-px hover:border-white/18 hover:bg-white/[0.07]",

  statCard:
    "group relative flex h-full min-h-[9rem] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.05] via-[#12183a]/50 to-transparent p-4 shadow-[0_10px_28px_rgba(0,0,0,0.22)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-200/20 hover:shadow-[0_12px_32px_rgba(0,82,255,0.12)] sm:min-h-[9.75rem] sm:p-5 sm:text-left",

  statLabel:
    "text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-white/45",

  statValue:
    "mt-auto pt-3 font-sans text-2xl font-bold tabular-nums tracking-tight text-text-primary sm:text-3xl",

  messageCard:
    "relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-panel-from/85 via-panel-via/78 to-panel-to/80 p-6 text-center shadow-[0_16px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:p-8",

  messageTitle:
    "font-sans text-base font-semibold text-text-primary sm:text-lg",

  primaryButton:
    "rounded-xl border border-cyan-300/25 bg-gradient-to-r from-base-blue via-indigo-600 to-violet-700 px-4 py-3 min-h-11 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(0,82,255,0.28)] transition-all duration-300 hover:-translate-y-px hover:opacity-95 hover:shadow-[0_12px_28px_rgba(0,82,255,0.4)]",

  secondaryButton:
    "rounded-xl border border-white/12 bg-white/[0.04] px-4 py-3 min-h-11 text-sm font-semibold text-white/80 transition-all duration-300 hover:border-white/20 hover:bg-white/[0.08] hover:text-white",

  badgeYou:
    "inline-flex shrink-0 rounded-badge border border-cyan-400/40 bg-cyan-500/15 px-1.5 py-0.5 text-[0.5rem] font-bold uppercase tracking-widest text-cyan-100 shadow-[0_0_12px_rgba(34,211,238,0.25)] sm:px-2 sm:text-[0.55rem]",

  gridStats:
    "grid grid-cols-2 items-stretch gap-3 sm:gap-4 md:grid-cols-4",

  gridCards:
    "grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 sm:gap-4",

  /** Top hairline used on glass panels */
  panelSheen:
    "pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent",

  panelGlow:
    "pointer-events-none absolute -left-8 -top-6 size-24 rounded-full bg-base-blue/[0.08] blur-3xl",
} as const;

export function formatWalletAddress(address: string) {
  if (address.length < 10) {
    return address;
  }

  return `${address.slice(0, 6)}···${address.slice(-4)}`;
}
