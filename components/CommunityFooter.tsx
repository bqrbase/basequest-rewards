import GlassPanel from "@/components/GlassPanel";
import { ui } from "@/lib/ui-styles";
import Link from "next/link";
import type { ReactNode } from "react";
import { SiFarcaster, SiX } from "react-icons/si";

const FOOTER_LINKS = [
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/contact", label: "Contact" },
] as const;

const X_URL = "https://x.com/bqrbase";
const FARCASTER_FOLLOW_URL = "https://farcaster.xyz/hqc";
const BASE_APP_URL = "https://base.app/invite/bqrbase/XB4JQGQK";
const FARCASTER_REFERRAL_URL = "https://farcaster.xyz/~/code/ITZOY0";

const socialButtonClassName =
  "inline-flex h-full min-h-[2.75rem] w-full min-w-0 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[0.7rem] font-semibold text-cyan-100/90 shadow-[0_8px_24px_rgba(0,0,0,0.18)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-300/30 hover:bg-white/[0.08] hover:text-white hover:shadow-[0_12px_28px_rgba(0,82,255,0.14)] sm:px-4";

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

/** 2×2 order: Follow on X | Follow on Farcaster / Get Base App | Get Farcaster */
const ACTIONS: Action[] = [
  {
    href: X_URL,
    label: "Follow on X",
    ariaLabel: "Follow on X — @bqrbase",
    icon: <SiX className="size-3.5 shrink-0 text-white" aria-hidden />,
  },
  {
    href: FARCASTER_FOLLOW_URL,
    label: "Follow on Farcaster",
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

/**
 * Shared community footer — full-width glass panel for major app pages.
 */
export default function CommunityFooter() {
  return (
    <section className={`${ui.dashSection} mt-auto pt-2`} aria-label="Community">
      <GlassPanel className={`w-full ${ui.dashCardPad} sm:p-6 lg:p-7`}>
        <div className="flex flex-col items-center text-center">
          <h2 className="font-sans text-base font-bold tracking-tight text-white sm:text-lg">
            Connect with the Builder
          </h2>
          <p className="mt-1.5 max-w-md text-xs leading-relaxed text-white/55 sm:text-sm">
            Building BaseQuest Rewards in public.
          </p>

          <div className="mt-4 grid w-full max-w-3xl grid-cols-1 gap-2.5 sm:mt-5 sm:grid-cols-2 sm:gap-3">
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

          <nav
            aria-label="Legal and information"
            className="mt-5 flex w-full max-w-3xl flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-white/10 pt-4 sm:mt-6 sm:gap-x-5"
          >
            {FOOTER_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-xs font-medium text-white/45 transition-colors hover:text-cyan-100/90 sm:text-sm"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </GlassPanel>
    </section>
  );
}
