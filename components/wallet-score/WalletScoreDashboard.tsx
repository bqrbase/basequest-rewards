"use client";

import { useWalletScoreData } from "@/hooks/useWalletScoreData";
import type { ScoreCategoryId } from "@/lib/wallet-score/scoring/types";
import { getScoreImprovementSuggestions } from "@/lib/wallet-score/scoring";
import { formatWalletAddress } from "@/lib/ui-styles";
import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const PALETTE = {
  base: "#0052ff",
  indigo: "#6366f1",
  cyan: "#22d3ee",
  violet: "#a78bfa",
  violetDeep: "#7c3aed",
  gold: "#fbbf24",
  green: "#34d399",
} as const;

const CHART_COLORS = [
  "#0052ff",
  "#6366f1",
  "#7c3aed",
  "#22d3ee",
  "#818cf8",
] as const;

const CHART_TICK = {
  fill: "rgb(255 255 255 / 70%)",
  fontSize: 10,
};

const CHART_GRID = "rgb(255 255 255 / 8%)";

const TOOLTIP_STYLE = {
  backgroundColor: "rgb(10 16 40 / 95%)",
  border: "1px solid rgb(99 102 241 / 30%)",
  borderRadius: "1rem",
  color: "#ffffff",
  fontSize: "12px",
  boxShadow: "0 12px 40px rgb(0 0 0 / 35%)",
};

const PROTOCOL_BAR_COLORS = [
  PALETTE.base,
  PALETTE.indigo,
  PALETTE.violetDeep,
  PALETTE.cyan,
  PALETTE.violet,
] as const;

function CompactScoreRing({
  score,
  maxScore,
  subtitle,
}: {
  score: number;
  maxScore: number;
  subtitle?: string;
}) {
  const data = [
    {
      name: "score",
      value: score,
      fill: PALETTE.gold,
    },
  ];

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative h-[5.25rem] w-[5.25rem] shrink-0 sm:h-[5.75rem] sm:w-[5.75rem]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-[-22%] rounded-full bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.32)_0%,rgba(0,82,255,0.2)_40%,transparent_72%)] blur-xl"
        />
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="76%"
            outerRadius="100%"
            barSize={7}
            data={data}
            startAngle={90}
            endAngle={-270}
          >
            <PolarAngleAxis
              type="number"
              domain={[0, maxScore]}
              angleAxisId={0}
              tick={false}
            />
            <RadialBar
              background={{ fill: "rgb(255 255 255 / 10%)" }}
              dataKey="value"
              cornerRadius={20}
              angleAxisId={0}
              isAnimationActive
              animationDuration={1100}
              animationEasing="ease-out"
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="bg-gradient-to-b from-white to-amber-100 bg-clip-text font-sans text-[1.65rem] font-bold leading-none tabular-nums tracking-tight text-transparent sm:text-[1.85rem]">
            {score}
          </p>
          <p className="mt-0.5 text-[0.4rem] font-semibold uppercase tracking-[0.14em] text-amber-200/60">
            / {maxScore}
          </p>
        </div>
      </div>
      {subtitle ? (
        <p className="max-w-[7.5rem] text-center text-[0.55rem] font-semibold uppercase tracking-[0.14em] text-amber-100/70">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

const HERO_CHIP_ACCENTS = {
  eth: {
    border: "border-base-blue/30 hover:border-base-blue/50",
    glow: "hover:shadow-[0_0_16px_rgba(0,82,255,0.18)]",
    label: "text-sky-200/55",
    bar: "bg-base-blue",
  },
  usdc: {
    border: "border-cyan-400/25 hover:border-cyan-300/45",
    glow: "hover:shadow-[0_0_16px_rgba(34,211,238,0.16)]",
    label: "text-cyan-200/55",
    bar: "bg-cyan-400",
  },
  txs: {
    border: "border-indigo-400/25 hover:border-indigo-300/45",
    glow: "hover:shadow-[0_0_16px_rgba(99,102,241,0.16)]",
    label: "text-indigo-200/55",
    bar: "bg-indigo-400",
  },
  active: {
    border: "border-violet-400/25 hover:border-violet-300/45",
    glow: "hover:shadow-[0_0_16px_rgba(167,139,250,0.16)]",
    label: "text-violet-200/55",
    bar: "bg-violet-400",
  },
} as const;

function HeroMetricChip({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: keyof typeof HERO_CHIP_ACCENTS;
}) {
  const tone = HERO_CHIP_ACCENTS[accent];

  return (
    <div
      className={`group relative min-w-0 flex-1 overflow-hidden rounded-xl border bg-white/[0.035] px-2.5 py-1.5 backdrop-blur-md transition-all duration-300 sm:px-3 sm:py-2 ${tone.border} ${tone.glow}`}
    >
      <span
        aria-hidden
        className={`absolute inset-y-0 left-0 w-0.5 ${tone.bar} opacity-70 transition-opacity duration-300 group-hover:opacity-100`}
      />
      <p
        className={`truncate pl-1.5 text-[0.45rem] font-semibold uppercase tracking-[0.14em] sm:text-[0.5rem] ${tone.label}`}
      >
        {label}
      </p>
      <p className="mt-0.5 truncate pl-1.5 font-sans text-sm font-bold tabular-nums tracking-tight text-white transition-transform duration-300 group-hover:translate-x-0.5 sm:text-base">
        {value}
      </p>
    </div>
  );
}

function Reveal({
  children,
  delayMs = 0,
  className = "",
}: {
  children: ReactNode;
  delayMs?: number;
  className?: string;
}) {
  return (
    <div
      className={`bq-fade-up ${className}`}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      {children}
    </div>
  );
}

function PortfolioChart({
  slices,
}: {
  slices: Array<{
    id: string;
    label: string;
    percent: number;
    valueUsd: string;
    color: string;
  }>;
}) {
  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
      <div className="h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="percent"
              nameKey="label"
              innerRadius={52}
              outerRadius={72}
              paddingAngle={3}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={1}
            >
              {slices.map((slice, index) => (
                <Cell
                  key={slice.id}
                  fill={CHART_COLORS[index % CHART_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value, name, item) => {
                const percent =
                  typeof value === "number" ? value : Number(value);
                const usd = item?.payload?.valueUsd ?? "";
                return [`${percent}% · ${usd}`, String(name)];
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="w-full space-y-2.5">
        {slices.map((slice, index) => {
          const color = CHART_COLORS[index % CHART_COLORS.length];
          return (
            <li
              key={slice.id}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span
                  className="size-2.5 shrink-0 rounded-full shadow-[0_0_8px_rgba(0,82,255,0.35)]"
                  style={{ backgroundColor: color }}
                  aria-hidden
                />
                <span className="truncate text-[0.7rem] uppercase tracking-wide text-white/55">
                  {slice.label}
                </span>
              </span>
              <span className="shrink-0 text-base font-bold tabular-nums text-white">
                {slice.percent}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ActivityChart({
  activity,
}: {
  activity: Array<{ day: string; transactions: number; volumeUsd: number }>;
}) {
  return (
    <div className="h-48 w-full sm:h-52">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={activity}
          margin={{ top: 8, right: 4, left: -18, bottom: 0 }}
        >
          <defs>
            <linearGradient id="walletActivityFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={PALETTE.base} stopOpacity={0.45} />
              <stop offset="50%" stopColor={PALETTE.indigo} stopOpacity={0.22} />
              <stop offset="100%" stopColor={PALETTE.cyan} stopOpacity={0.04} />
            </linearGradient>
            <linearGradient id="walletActivityStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={PALETTE.base} />
              <stop offset="50%" stopColor={PALETTE.indigo} />
              <stop offset="100%" stopColor={PALETTE.cyan} />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke={CHART_GRID}
            strokeDasharray="3 3"
            vertical={false}
          />
          <XAxis
            dataKey="day"
            tick={CHART_TICK}
            axisLine={false}
            tickLine={false}
            minTickGap={28}
          />
          <YAxis
            tick={CHART_TICK}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value, name) => {
              if (name === "transactions") {
                return [value, "Transactions"];
              }
              return [`$${Number(value).toLocaleString()}`, "Volume"];
            }}
          />
          <Area
            type="monotone"
            dataKey="transactions"
            stroke="url(#walletActivityStroke)"
            strokeWidth={2.75}
            fill="url(#walletActivityFill)"
            activeDot={{
              r: 5,
              fill: "#ffffff",
              stroke: PALETTE.cyan,
              strokeWidth: 2,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function sourceBadge(source: "live" | "mock" | "unavailable") {
  if (source === "live") {
    return (
      <span className="rounded-badge border border-cyan-400/40 bg-cyan-500/10 px-2 py-0.5 text-[0.5rem] font-semibold uppercase tracking-widest text-cyan-200">
        Live
      </span>
    );
  }

  if (source === "unavailable") {
    return (
      <span className="rounded-badge border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[0.5rem] font-semibold uppercase tracking-widest text-white/45">
        —
      </span>
    );
  }

  return (
    <span className="rounded-badge border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[0.5rem] font-semibold uppercase tracking-widest text-white/40">
      Mock
    </span>
  );
}

function StatIcon({ id }: { id: string }) {
  const common = "size-4";
  switch (id) {
    case "age":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.75" />
          <path
            d="M12 8v4.5l3 1.5"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
      );
    case "txs":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M7 7h11l-2.5-2.5M17 17H6l2.5 2.5M6 12h12"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "eth":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 3l6 9-6 3.5L6 12l6-9zm0 14.5L18 12l-6 9-6-9 6 5.5z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "usdc":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.75" />
          <path
            d="M12 7.5v9M9.5 9.5c.6-.7 1.5-1 2.5-1 1.7 0 3 1 3 2.5S13.7 13.5 12 13.5 9 14.5 9 16c0 1.1.9 2 2.5 2 1.1 0 2-.4 2.5-1"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case "active":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect
            x="4"
            y="5"
            width="16"
            height="15"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.75"
          />
          <path
            d="M8 3v4M16 3v4M4 10h16"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
      );
    case "nfts":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect
            x="4"
            y="5"
            width="16"
            height="14"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.75"
          />
          <circle cx="9" cy="10" r="1.5" fill="currentColor" />
          <path
            d="M4 16l4.5-4 3 3 3-4L20 16"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "tokens":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="9" cy="12" r="5.5" stroke="currentColor" strokeWidth="1.75" />
          <path
            d="M14.2 8.2a5.5 5.5 0 110 7.6"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
      );
    case "contracts":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M8 7h8M8 12h5M8 17h6"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <rect
            x="4"
            y="4"
            width="16"
            height="16"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.75"
          />
        </svg>
      );
    default:
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.75" />
        </svg>
      );
  }
}

function getStatCardAccent(id: string) {
  switch (id) {
    case "age":
      return {
        edge: "border-l-amber-400/55",
        wash: "from-amber-500/[0.1]",
        icon: "border-amber-300/35 bg-amber-400/15 text-amber-200",
        hover: "hover:border-amber-300/25 hover:shadow-[0_12px_32px_rgba(251,191,36,0.08)]",
      };
    case "txs":
      return {
        edge: "border-l-indigo-400/55",
        wash: "from-indigo-500/[0.1]",
        icon: "border-indigo-300/35 bg-indigo-400/15 text-indigo-200",
        hover: "hover:border-indigo-300/25 hover:shadow-[0_12px_32px_rgba(99,102,241,0.1)]",
      };
    case "eth":
      return {
        edge: "border-l-base-blue/65",
        wash: "from-base-blue/[0.12]",
        icon: "border-sky-300/35 bg-base-blue/20 text-sky-100",
        hover: "hover:border-sky-300/25 hover:shadow-[0_12px_32px_rgba(0,82,255,0.12)]",
      };
    case "usdc":
      return {
        edge: "border-l-cyan-400/55",
        wash: "from-cyan-500/[0.1]",
        icon: "border-cyan-300/35 bg-cyan-400/15 text-cyan-100",
        hover: "hover:border-cyan-300/25 hover:shadow-[0_12px_32px_rgba(34,211,238,0.1)]",
      };
    case "active":
      return {
        edge: "border-l-cyan-300/50",
        wash: "from-cyan-400/[0.09]",
        icon: "border-cyan-200/35 bg-cyan-400/12 text-cyan-100",
        hover: "hover:border-cyan-200/25 hover:shadow-[0_12px_32px_rgba(34,211,238,0.08)]",
      };
    case "nfts":
      return {
        edge: "border-l-violet-400/55",
        wash: "from-violet-500/[0.11]",
        icon: "border-violet-300/35 bg-violet-400/15 text-violet-100",
        hover: "hover:border-violet-300/25 hover:shadow-[0_12px_32px_rgba(167,139,250,0.1)]",
      };
    case "tokens":
      return {
        edge: "border-l-sky-400/50",
        wash: "from-sky-500/[0.09]",
        icon: "border-sky-300/30 bg-sky-400/12 text-sky-100",
        hover: "hover:border-sky-300/20 hover:shadow-[0_12px_32px_rgba(56,189,248,0.08)]",
      };
    case "contracts":
      return {
        edge: "border-l-violet-300/50",
        wash: "from-violet-400/[0.09]",
        icon: "border-violet-200/30 bg-violet-400/12 text-violet-100",
        hover: "hover:border-violet-200/20 hover:shadow-[0_12px_32px_rgba(139,92,246,0.08)]",
      };
    default:
      return {
        edge: "border-l-white/20",
        wash: "from-white/[0.04]",
        icon: "border-white/15 bg-white/10 text-white/70",
        hover: "hover:border-white/14",
      };
  }
}

/** Shared Hero-family surface — primary has more depth, secondary stays quieter */
function panelClassName(emphasis: "primary" | "secondary" = "primary") {
  if (emphasis === "secondary") {
    return "relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.03] shadow-[0_8px_24px_rgba(0,0,0,0.2)] backdrop-blur-xl transition-all duration-200 hover:border-white/12 hover:bg-white/[0.045]";
  }

  return "relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#0c142e]/85 via-[#12183a]/78 to-[#151040]/80 shadow-[0_16px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl transition-all duration-200 hover:border-cyan-200/15 hover:shadow-[0_20px_48px_rgba(0,0,0,0.34)]";
}

function SectionHeading({
  eyebrow,
  title,
  description,
  badge,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  badge?: ReactNode;
}) {
  return (
    <div className="mb-6 sm:mb-7">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-white/40">
          {eyebrow}
        </p>
        {badge}
      </div>
      <h2 className="mt-1.5 font-sans text-xl font-bold tracking-tight text-white sm:mt-2 sm:text-2xl lg:text-3xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/45 sm:mt-3 sm:text-base">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function PanelGlow({ tone = "neutral" }: { tone?: "neutral" | "hero" }) {
  if (tone === "hero") {
    return (
      <>
        <div
          aria-hidden
          className="pointer-events-none absolute -left-12 -top-10 size-36 rounded-full bg-base-blue/25 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 top-0 size-28 rounded-full bg-indigo-500/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-1/3 size-24 rounded-full bg-cyan-400/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/30 to-transparent"
        />
      </>
    );
  }

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute -left-8 -top-6 size-24 rounded-full bg-base-blue/[0.08] blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"
      />
    </>
  );
}

/** Short display labels for the Score Breakdown list (engine labels unchanged). */
const BREAKDOWN_DISPLAY_LABELS: Record<ScoreCategoryId, string> = {
  walletAge: "Wallet Age",
  transactionCount: "Transactions",
  activeDays: "Active Days",
  contractInteractions: "Contract Usage",
  assetDiversity: "Asset Diversity",
  nftActivity: "NFT Activity",
  baseEcosystemUsage: "Base Usage",
  consistency: "Consistency",
};

const BREAKDOWN_BAR_TONES: Record<ScoreCategoryId, string> = {
  walletAge: "from-amber-400 to-amber-300",
  transactionCount: "from-indigo-400 to-violet-300",
  activeDays: "from-cyan-400 to-sky-300",
  contractInteractions: "from-violet-400 to-fuchsia-300",
  assetDiversity: "from-base-blue to-sky-400",
  nftActivity: "from-violet-300 to-indigo-300",
  baseEcosystemUsage: "from-base-blue to-cyan-400",
  consistency: "from-emerald-400 to-teal-300",
};

function FallbackCard({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] via-[#12183a]/40 to-transparent px-4 py-8 text-center shadow-[0_8px_24px_rgba(0,0,0,0.2)] backdrop-blur-xl sm:px-6">
      <p className="text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-white/40">
        {title}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-white/55">{message}</p>
    </div>
  );
}

function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#0c142e]/85 via-[#12183a]/78 to-[#151040]/80 p-5 shadow-[0_16px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:p-6">
      <div className="animate-pulse space-y-3">
        <div className="h-3 w-24 rounded bg-white/10" />
        <div className="h-6 w-48 rounded bg-white/10" />
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="h-12 rounded-xl bg-white/[0.06]" />
        ))}
      </div>
    </div>
  );
}

function StatusBanner({
  message,
  fromCache,
  isRefreshing,
}: {
  message: string;
  fromCache?: boolean;
  isRefreshing?: boolean;
}) {
  return (
    <div
      role="status"
      className="rounded-2xl border border-amber-400/25 bg-gradient-to-r from-amber-500/15 via-[#17133a]/70 to-[#0f1a3d]/80 px-4 py-3 text-sm text-amber-50/90 shadow-[0_8px_24px_rgba(0,0,0,0.2)] backdrop-blur-xl sm:px-5"
    >
      <p className="leading-relaxed">{message}</p>
      {fromCache || isRefreshing ? (
        <p className="mt-1 text-xs text-amber-100/55">
          {isRefreshing
            ? "Refreshing live Base data…"
            : "Using recently saved data."}
        </p>
      ) : null}
    </div>
  );
}

type SectionKind = "loading" | "connect" | "empty" | "error" | "data";

function resolveSectionKind(options: {
  isConnected: boolean;
  isLoading: boolean;
  hasData: boolean;
  health: "ok" | "degraded" | "empty" | "unavailable";
  sectionError?: string;
}): SectionKind {
  if (!options.isConnected) {
    return "connect";
  }
  if (options.isLoading) {
    return "loading";
  }
  if (options.hasData) {
    return "data";
  }
  if (options.health === "empty") {
    return "empty";
  }
  if (options.sectionError || options.health === "unavailable") {
    return "error";
  }
  return "empty";
}

function sectionFallbackMessage(
  kind: SectionKind,
  emptyMessage: string,
  errorMessage?: string | null,
) {
  if (kind === "connect") {
    return "Connect a wallet to load live Base analytics for this section.";
  }
  if (kind === "error") {
    return (
      errorMessage ||
      "This section is temporarily unavailable. Please try again shortly."
    );
  }
  return emptyMessage;
}

export default function WalletScoreDashboard() {
  const view = useWalletScoreData();
  const { hero, stats, live, analytics, score, ecosystem } = view;
  const improvementSuggestions = getScoreImprovementSuggestions(
    score.breakdown,
    score.maxScore,
  );
  const sectionSource = analytics.source;
  const bannerMessage =
    live.errors.analytics || analytics.statusMessage || null;

  const statById = (id: string) =>
    stats.find((stat) => stat.id === id)?.value ?? "—";

  return (
    <div className="flex flex-col gap-10 sm:gap-12 lg:gap-14">
      <style>{`
        @keyframes bq-fade-up {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .bq-fade-up {
          animation: bq-fade-up 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @media (prefers-reduced-motion: reduce) {
          .bq-fade-up {
            animation: none;
          }
        }
      `}</style>

      {bannerMessage && live.isConnected ? (
        <StatusBanner
          message={bannerMessage}
          fromCache={analytics.fromCache}
          isRefreshing={live.isRefreshing}
        />
      ) : null}

      {/* 1. Hero */}
      <Reveal>
        <section>
          <article className="relative overflow-hidden rounded-2xl border border-white/12 bg-gradient-to-br from-[#0a1430] via-[#121c44] to-[#1a1348] px-3.5 py-3 shadow-[0_24px_56px_rgba(0,0,0,0.42),0_0_40px_rgba(0,82,255,0.14)] backdrop-blur-xl sm:px-5 sm:py-3.5">
            <PanelGlow tone="hero" />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(34,211,238,0.08),transparent_45%),radial-gradient(ellipse_at_bottom_left,rgba(0,82,255,0.12),transparent_50%)]"
            />

            <div className="relative z-10 flex flex-col gap-2.5">
              <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-[minmax(0,1.2fr)_auto_minmax(0,1fr)] sm:gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative shrink-0">
                    <div
                      aria-hidden
                      className="absolute -inset-1.5 rounded-full bg-[radial-gradient(circle,rgba(0,82,255,0.5),rgba(34,211,238,0.18),transparent_70%)] blur-md"
                    />
                    <div className="relative flex size-11 items-center justify-center rounded-full border border-cyan-200/25 bg-gradient-to-br from-base-blue via-indigo-600 to-violet-700 text-sm font-bold tracking-tight text-white shadow-[0_0_22px_rgba(0,82,255,0.4)] sm:size-12">
                      BQ
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-[0.55rem] font-semibold uppercase tracking-[0.18em] text-cyan-200/55">
                      Analytics
                    </p>
                    <h1 className="truncate font-sans text-base font-bold leading-tight tracking-tight text-white sm:text-lg lg:text-xl">
                      Base Wallet Score
                    </h1>
                    {!live.isConnected ? (
                      <p className="mt-0.5 truncate text-xs text-white/50">
                        Connect wallet for live Base data
                      </p>
                    ) : (
                      <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                        {hero.basename ? (
                          <p className="truncate font-sans text-sm font-semibold text-white">
                            {hero.basename}
                          </p>
                        ) : null}
                        <p
                          className="truncate font-mono text-[0.65rem] tracking-wide text-white/50"
                          title={hero.walletAddress}
                        >
                          {formatWalletAddress(hero.walletAddress)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-center rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-black/25 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                  <CompactScoreRing
                    score={hero.score}
                    maxScore={hero.maxScore}
                    subtitle={
                      hero.tier !== "—" ? `${hero.tier} Score` : "Wallet Score"
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-1.5 sm:justify-items-end">
                  <span className="inline-flex w-fit max-w-full truncate rounded-full border border-amber-400/50 bg-amber-500/15 px-2.5 py-1 text-[0.55rem] font-semibold uppercase tracking-widest text-amber-50 transition-colors duration-300 hover:bg-amber-500/25">
                    {hero.tier}
                  </span>
                  <span className="inline-flex w-fit max-w-full truncate rounded-full border border-indigo-300/35 bg-indigo-500/15 px-2.5 py-1 text-[0.55rem] font-semibold uppercase tracking-widest text-indigo-100 transition-colors duration-300 hover:bg-indigo-500/25 sm:justify-self-end">
                    {hero.percentile}
                  </span>
                  <span className="inline-flex w-fit max-w-full truncate rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[0.55rem] font-semibold uppercase tracking-widest text-white/60 transition-colors duration-300 hover:bg-white/[0.08]">
                    Age {statById("age")}
                  </span>
                  <span className="inline-flex w-fit max-w-full items-center gap-1 truncate rounded-full border border-emerald-400/40 bg-emerald-500/12 px-2.5 py-1 text-[0.55rem] font-semibold uppercase tracking-widest text-emerald-100 transition-colors duration-300 hover:bg-emerald-500/20 sm:justify-self-end">
                    <span
                      aria-hidden
                      className="size-1.5 shrink-0 rounded-full bg-emerald-300"
                    />
                    Verified
                  </span>
                </div>
              </div>

              {/* Integrated metric strip */}
              <div className="rounded-xl border border-white/[0.06] bg-black/15 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-2">
                <div className="flex gap-1.5 sm:gap-2">
                  <HeroMetricChip
                    label="ETH Balance"
                    value={statById("eth")}
                    accent="eth"
                  />
                  <HeroMetricChip
                    label="USDC Balance"
                    value={statById("usdc")}
                    accent="usdc"
                  />
                  <HeroMetricChip
                    label="Transactions"
                    value={statById("txs")}
                    accent="txs"
                  />
                  <HeroMetricChip
                    label="Active Days"
                    value={statById("active")}
                    accent="active"
                  />
                </div>
              </div>
            </div>
          </article>
        </section>
      </Reveal>

      {/* Score Breakdown — engine category points */}
      <Reveal delayMs={60}>
        <section>
          <SectionHeading
            eyebrow="Model"
            title="Score Breakdown"
            description="Your score is calculated from your onchain activity on Base."
          />
          <article className={`${panelClassName("primary")} p-5 sm:p-6`}>
            <PanelGlow />
            <ul className="relative z-10 space-y-4 sm:space-y-5">
              {score.breakdown.map((row) => {
                const maxPoints = Math.round(row.weight * score.maxScore);
                const earnedPoints = Math.round(row.weightedPoints);
                const progress =
                  maxPoints > 0
                    ? Math.min(100, (row.weightedPoints / maxPoints) * 100)
                    : 0;

                return (
                  <li key={row.id} className="space-y-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="min-w-0 truncate text-sm font-semibold text-white sm:text-[0.95rem]">
                        {BREAKDOWN_DISPLAY_LABELS[row.id]}
                      </p>
                      <p className="shrink-0 font-mono text-sm tabular-nums text-white/80">
                        <span className="font-semibold text-white">
                          {earnedPoints}
                        </span>
                        <span className="text-white/40"> / {maxPoints}</span>
                      </p>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${BREAKDOWN_BAR_TONES[row.id]} transition-[width] duration-700 ease-out`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </article>
        </section>
      </Reveal>

      {/* How to Improve — lowest categories from engine breakdown */}
      <Reveal delayMs={90}>
        <section>
          <SectionHeading
            eyebrow="Growth"
            title="How to Improve Your Score"
            description="Focus on the categories with the most room to grow."
          />
          {improvementSuggestions.length === 0 ? (
            <article className={`${panelClassName("secondary")} p-5 sm:p-6`}>
              <PanelGlow />
              <p className="relative z-10 text-sm leading-relaxed text-white/55">
                You are already strong across scored categories. Keep steady
                Base activity to maintain your rank.
              </p>
            </article>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-3">
              {improvementSuggestions.map((tip) => (
                <article
                  key={tip.id}
                  className={`${panelClassName("primary")} flex flex-col p-5 transition-transform duration-300 hover:-translate-y-0.5 sm:p-6`}
                >
                  <PanelGlow />
                  <div className="relative z-10 flex flex-1 flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-white sm:text-[0.95rem]">
                        {tip.categoryLabel}
                      </p>
                      <span className="shrink-0 rounded-badge border border-cyan-300/30 bg-cyan-500/15 px-2 py-0.5 text-[0.55rem] font-semibold uppercase tracking-widest text-cyan-100">
                        +{tip.potentialGain} pts
                      </span>
                    </div>
                    <p className="mt-3 font-mono text-sm tabular-nums text-white/70">
                      <span className="font-semibold text-white">
                        {tip.currentPoints}
                      </span>
                      <span className="text-white/40">
                        {" "}
                        / {tip.maxPoints}
                      </span>
                      <span className="ml-2 text-[0.65rem] uppercase tracking-widest text-white/40">
                        current
                      </span>
                    </p>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${BREAKDOWN_BAR_TONES[tip.id]}`}
                        style={{
                          width: `${
                            tip.maxPoints > 0
                              ? Math.min(
                                  100,
                                  (tip.currentPoints / tip.maxPoints) * 100,
                                )
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    <p className="mt-4 text-sm leading-relaxed text-white/55">
                      {tip.recommendation}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </Reveal>

      {/* Wallet Stats */}
      <Reveal delayMs={100}>
        <section>
          <SectionHeading eyebrow="Overview" title="Wallet Stats" />
          {live.isLoading ? (
            <div className="grid grid-cols-2 items-stretch gap-3.5 sm:gap-5 lg:grid-cols-4">
              {Array.from({ length: 8 }, (_, index) => (
                <div
                  key={index}
                  className="min-h-[9rem] animate-pulse rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4 sm:min-h-[9.75rem] sm:p-5"
                >
                  <div className="h-8 w-8 rounded-lg bg-white/10" />
                  <div className="mt-4 h-3 w-20 rounded bg-white/10" />
                  <div className="mt-3 h-8 w-16 rounded bg-white/10" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 items-stretch gap-3.5 sm:gap-5 lg:grid-cols-4">
              {stats.map((stat, index) => {
                const isLive = stat.source === "live";
                const accent = getStatCardAccent(stat.id);
                return (
                  <article
                    key={stat.id}
                    className={`bq-fade-up group relative flex h-full min-h-[9rem] flex-col overflow-hidden rounded-2xl border border-white/[0.08] border-l-[3px] bg-gradient-to-br ${accent.wash} to-transparent p-4 shadow-[0_10px_28px_rgba(0,0,0,0.22)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 sm:min-h-[9.75rem] sm:p-5 ${accent.edge} ${accent.hover} ${
                      isLive ? "opacity-100" : "opacity-85"
                    }`}
                    style={{ animationDelay: `${140 + index * 40}ms` }}
                  >
                    <div className="relative z-10 flex items-start justify-between gap-2">
                      <div
                        className={`flex size-8 items-center justify-center rounded-lg border sm:size-9 ${accent.icon}`}
                      >
                        <StatIcon id={stat.id} />
                      </div>
                      {sourceBadge(stat.source)}
                    </div>
                    <p className="relative z-10 mt-3.5 text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-white/45">
                      {stat.label}
                    </p>
                    <p className="relative z-10 mt-1.5 font-sans text-3xl font-bold tabular-nums tracking-tight text-white transition-transform duration-300 group-hover:translate-x-0.5 sm:text-4xl">
                      {stat.value}
                    </p>
                    <p className="relative z-10 mt-2 text-[0.7rem] leading-relaxed text-white/40">
                      {stat.hint}
                    </p>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </Reveal>

      {/* Charts */}
      <Reveal delayMs={140}>
        <section className="grid grid-cols-1 items-stretch gap-4 sm:gap-5 lg:grid-cols-2">
          <article
            className={`${panelClassName("primary")} p-5 transition-transform duration-300 hover:-translate-y-0.5 sm:p-7`}
          >
            <PanelGlow />
            <div className="relative z-10">
              <div className="mb-4 flex items-center justify-between gap-2 sm:mb-5">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-white/40">
                  Allocation
                </p>
                {sourceBadge(sectionSource)}
              </div>
              <h2 className="mt-1.5 font-sans text-lg font-bold tracking-tight text-white sm:text-xl">
                Portfolio Distribution
              </h2>
              <div className="mt-5">
                {(() => {
                  const kind = resolveSectionKind({
                    isConnected: live.isConnected,
                    isLoading: live.isLoading,
                    hasData: analytics.portfolioDistribution.length > 0,
                    health: analytics.health,
                    sectionError: analytics.sectionErrors.portfolio,
                  });
                  if (kind === "loading") {
                    return <SectionSkeleton rows={3} />;
                  }
                  if (kind !== "data") {
                    return (
                      <FallbackCard
                        title="Allocation"
                        message={sectionFallbackMessage(
                          kind,
                          "No portfolio holdings detected on Base yet.",
                          analytics.sectionErrors.portfolio ||
                            analytics.statusMessage,
                        )}
                      />
                    );
                  }
                  return (
                    <PortfolioChart slices={analytics.portfolioDistribution} />
                  );
                })()}
              </div>
            </div>
          </article>

          <article
            className={`${panelClassName("primary")} p-5 transition-transform duration-300 hover:-translate-y-0.5 sm:p-7`}
          >
            <PanelGlow />
            <div className="relative z-10">
              <div className="mb-4 flex items-center justify-between gap-2 sm:mb-5">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-white/40">
                  Momentum
                </p>
                {sourceBadge(sectionSource)}
              </div>
              <h2 className="mt-1.5 font-sans text-lg font-bold tracking-tight text-white sm:text-xl">
                Wallet Activity
              </h2>
              <p className="mt-1 text-sm text-white/50">
                Transactions over the last 14 days
              </p>
              <div className="mt-5">
                {(() => {
                  const kind = resolveSectionKind({
                    isConnected: live.isConnected,
                    isLoading: live.isLoading,
                    hasData: analytics.walletActivity.some(
                      (point) => point.transactions > 0,
                    ),
                    health: analytics.health,
                    sectionError: analytics.sectionErrors.activity,
                  });
                  if (kind === "loading") {
                    return <SectionSkeleton rows={3} />;
                  }
                  if (kind === "data" || analytics.walletActivity.length > 0) {
                    return (
                      <ActivityChart activity={analytics.walletActivity} />
                    );
                  }
                  return (
                    <FallbackCard
                      title="Momentum"
                      message={sectionFallbackMessage(
                        kind,
                        "No recent Base activity in the last 14 days.",
                        analytics.sectionErrors.activity ||
                          analytics.statusMessage,
                      )}
                    />
                  );
                })()}
              </div>
            </div>
          </article>
        </section>
      </Reveal>

      {/* 8. Achievements */}
      <Reveal delayMs={320}>
      <section>
        <SectionHeading
          eyebrow="Milestones"
          title="Achievements"
          badge={sourceBadge(sectionSource)}
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          {analytics.achievements.map((item) => (
            <article
              key={item.id}
              className={`relative flex min-h-[6.5rem] flex-col overflow-hidden rounded-card border p-4 shadow-[0_8px_24px_rgba(0,0,0,0.2)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 sm:min-h-[7rem] sm:p-5 ${
                item.unlocked
                  ? "border-white/14 bg-white/[0.05] hover:border-violet-300/30 hover:bg-white/[0.07]"
                  : "border-white/[0.06] bg-white/[0.02] opacity-50 hover:opacity-70"
              }`}
            >
              <PanelGlow />
              <p
                className={`relative z-10 text-[0.6rem] font-semibold uppercase tracking-[0.16em] sm:text-[0.65rem] ${
                  item.unlocked ? "text-white/85" : "text-white/40"
                }`}
              >
                {item.title}
              </p>
              <p className="relative z-10 mt-2 flex-1 text-xs leading-relaxed text-white/50">
                {item.description}
              </p>
              <p className="relative z-10 mt-3 text-[0.55rem] font-semibold uppercase tracking-widest text-white/45">
                {item.unlocked ? "Unlocked" : "Locked"}
              </p>
            </article>
          ))}
        </div>
      </section>
      </Reveal>

      {/* Ecosystem Usage — existing analysis output */}
      <Reveal delayMs={400}>
        <section>
          <SectionHeading
            eyebrow="Ecosystem"
            title="Ecosystem Usage"
            badge={sourceBadge(ecosystem.source)}
            description="Protocols detected from your Base contract interactions and their contribution to Wallet Score."
          />
          <article className={`${panelClassName("primary")} p-5 sm:p-6`}>
            <PanelGlow />
            <div className="relative z-10 space-y-5">
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 sm:px-4 sm:py-3">
                  <p className="text-[0.5rem] font-semibold uppercase tracking-[0.14em] text-cyan-200/55">
                    Unique Protocols
                  </p>
                  <p className="mt-1 font-sans text-xl font-bold tabular-nums text-white sm:text-2xl">
                    {ecosystem.protocolsUsed}
                  </p>
                </div>
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 sm:px-4 sm:py-3">
                  <p className="text-[0.5rem] font-semibold uppercase tracking-[0.14em] text-indigo-200/55">
                    Interactions
                  </p>
                  <p className="mt-1 font-sans text-xl font-bold tabular-nums text-white sm:text-2xl">
                    {ecosystem.contractInteractions.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 sm:px-4 sm:py-3">
                  <p className="text-[0.5rem] font-semibold uppercase tracking-[0.14em] text-violet-200/55">
                    Category Score
                  </p>
                  <p className="mt-1 font-sans text-xl font-bold tabular-nums text-white sm:text-2xl">
                    {Math.round(ecosystem.ecosystemScore)}
                    <span className="text-sm font-semibold text-white/40">
                      {" "}
                      / 100
                    </span>
                  </p>
                </div>
                <div className="rounded-xl border border-cyan-400/25 bg-gradient-to-br from-base-blue/20 to-cyan-500/10 px-3 py-2.5 sm:px-4 sm:py-3">
                  <p className="text-[0.5rem] font-semibold uppercase tracking-[0.14em] text-sky-200/70">
                    Score Contribution
                  </p>
                  <p className="mt-1 font-sans text-xl font-bold tabular-nums text-white sm:text-2xl">
                    {ecosystem.scorePoints}
                    <span className="text-sm font-semibold text-white/40">
                      {" "}
                      / {ecosystem.scorePointsMax}
                    </span>
                  </p>
                </div>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-base-blue to-cyan-400 transition-[width] duration-700 ease-out"
                  style={{
                    width: `${
                      ecosystem.scorePointsMax > 0
                        ? Math.min(
                            100,
                            (ecosystem.scorePoints / ecosystem.scorePointsMax) *
                              100,
                          )
                        : 0
                    }%`,
                  }}
                />
              </div>

              {ecosystem.protocols.length === 0 ? (
                <p className="text-sm leading-relaxed text-white/50">
                  {live.isConnected
                    ? "No known Base ecosystem protocols detected in recent activity yet."
                    : "Connect a wallet to analyze Base ecosystem usage."}
                </p>
              ) : (
                <div className="space-y-3.5 sm:space-y-4">
                  <p className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-white/40">
                    Protocols Detected
                  </p>
                  {ecosystem.protocols.map((protocol, index) => (
                    <div key={protocol.id} className="space-y-2">
                      <div className="flex flex-wrap items-end justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white">
                            {protocol.name}
                          </p>
                          <p className="text-xs text-white/45">
                            {protocol.interactions.toLocaleString()} interactions
                          </p>
                        </div>
                        <p className="shrink-0 font-mono text-sm font-semibold tabular-nums text-white/80">
                          {protocol.share}%
                        </p>
                      </div>
                      <div className="h-2 overflow-hidden rounded-badge bg-white/10">
                        <div
                          className="h-full rounded-badge transition-[width] duration-700 ease-out"
                          style={{
                            width: `${Math.min(100, protocol.share)}%`,
                            background: `linear-gradient(90deg, ${PROTOCOL_BAR_COLORS[index % PROTOCOL_BAR_COLORS.length]}, #c4b5fd)`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </article>
        </section>
      </Reveal>
    </div>
  );
}
