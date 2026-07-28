import GlassPanel from "@/components/GlassPanel";
import type { ReactNode } from "react";
import { SiFarcaster, SiX } from "react-icons/si";

const X_URL = "https://x.com/bqrbase";
const FARCASTER_FOLLOW_URL = "https://farcaster.xyz/hqc";
const BASE_APP_URL = "https://base.app/invite/bqrbase/XB4JQGQK";
const FARCASTER_REFERRAL_URL = "https://farcaster.xyz/~/code/ITZOY0";

type ConnectWithBuilderProps = {
  variant: "mobile" | "desktop";
};

const socialButtonClassName =
  "inline-flex h-full min-h-[2.75rem] w-full min-w-0 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[0.7rem] font-semibold text-cyan-100/90 shadow-[0_8px_24px_rgba(0,0,0,0.18)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-300/30 hover:bg-white/[0.08] hover:text-white hover:shadow-[0_12px_28px_rgba(0,82,255,0.14)]";

function BaseAppLogoIcon() {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- official Base App PNG; preserve original colors
    <img
      src="/images/base-app.png"
      alt=""
      width={22}
      height={22}
      className="size-[22px] shrink-0 object-contain"
      aria-hidden
      draggable={false}
    />
  );
}

type Action = {
  href: string;
  label: string;
  ariaLabel: string;
  icon: ReactNode;
};

const ACTIONS: Action[] = [
  {
    href: X_URL,
    label: "@bqrbase",
    ariaLabel: "Follow on X — @bqrbase",
    icon: <SiX className="size-3.5 shrink-0 text-white" aria-hidden />,
  },
  {
    href: FARCASTER_FOLLOW_URL,
    label: "@hqc",
    ariaLabel: "Follow on Farcaster — @hqc",
    icon: (
      <SiFarcaster className="size-3.5 shrink-0 text-[#855DFF]" aria-hidden />
    ),
  },
  {
    href: BASE_APP_URL,
    label: "Get Base App",
    ariaLabel: "Get Base App",
    icon: <BaseAppLogoIcon />,
  },
  {
    href: FARCASTER_REFERRAL_URL,
    label: "Get Farcaster",
    ariaLabel: "Get Farcaster",
    icon: (
      <SiFarcaster className="size-3.5 shrink-0 text-[#855DFF]" aria-hidden />
    ),
  },
];

function SocialButtons({
  className = "",
  columns,
}: {
  className?: string;
  columns: 1 | 2;
}) {
  return (
    <div
      className={`grid w-full gap-2.5 ${
        columns === 2 ? "grid-cols-2" : "grid-cols-1"
      } ${className}`}
    >
      {ACTIONS.map((action) => (
        <a
          key={action.href}
          href={action.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={action.ariaLabel}
          className={socialButtonClassName}
        >
          {action.icon}
          <span className="truncate">{action.label}</span>
        </a>
      ))}
    </div>
  );
}

/**
 * Builder community card — desktop beside hero; mobile under description.
 */
export default function ConnectWithBuilder({
  variant,
}: ConnectWithBuilderProps) {
  if (variant === "mobile") {
    return (
      <GlassPanel className="!p-0 px-3.5 pb-3 pt-3.5 sm:px-4 sm:pb-3 sm:pt-4">
        <div className="flex flex-col items-center text-center">
          <h2 className="font-sans text-base font-bold tracking-tight text-white">
            Connect with the Builder
          </h2>
          <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-white/55">
            Building BaseQuest Rewards in public.
          </p>
          <SocialButtons className="mt-3 max-w-sm" columns={1} />
        </div>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel className="!p-0 w-full">
      <div className="flex min-h-[11.5rem] flex-col justify-center px-5 py-7 lg:min-h-[12.5rem] lg:px-6 lg:py-8">
        <h2 className="font-sans text-lg font-bold tracking-tight text-white sm:text-xl">
          Connect with the Builder
        </h2>
        <p className="mt-2.5 text-sm leading-relaxed text-white/55">
          Building BaseQuest Rewards in public.
        </p>
        <SocialButtons className="mt-6" columns={2} />
      </div>
    </GlassPanel>
  );
}
