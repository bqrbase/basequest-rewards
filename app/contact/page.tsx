import GlassPanel from "@/components/GlassPanel";
import PageShell from "@/components/PageShell";
import { ui } from "@/lib/ui-styles";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiDiscord, SiFarcaster, SiX } from "react-icons/si";

export const metadata: Metadata = {
  title: "Contact Us | BaseQuest Rewards",
  description:
    "Contact BaseQuest Rewards — official website, X, Farcaster, Discord, and support@basequest.online.",
  openGraph: {
    title: "Contact Us | BaseQuest Rewards",
    description:
      "Contact BaseQuest Rewards — official website, X, Farcaster, Discord, and support@basequest.online.",
    url: "/contact",
  },
};

type ContactCard = {
  label: string;
  value: string;
  description: string;
  href?: string;
  icon: ReactNode;
  external?: boolean;
  /** Optional prefix shown before the value (e.g. "Username:"). */
  valuePrefix?: string;
  /**
   * Optional secondary CTA (e.g. Discord invite).
   * Set `cta.href` later to show a "Join Discord" button without redesign.
   */
  cta?: {
    label: string;
    href?: string;
  };
};

/** Set this when a Discord invite URL is available — CTA renders automatically. */
const DISCORD_INVITE_URL: string | undefined = undefined;

const CONTACT_CARDS: ContactCard[] = [
  {
    label: "Official Website",
    value: "basequest.online",
    description: "Visit the official BaseQuest Rewards website.",
    href: "https://basequest.online",
    external: true,
    icon: (
      <span className="text-sm font-bold text-cyan-100" aria-hidden>
        BQ
      </span>
    ),
  },
  {
    label: "X",
    value: "@bqrbase",
    description: "Follow product updates and announcements.",
    href: "https://x.com/bqrbase",
    external: true,
    icon: <SiX className="size-5 text-white" aria-hidden />,
  },
  {
    label: "Farcaster",
    value: "@hqc",
    description: "Join the conversation with the builder community.",
    href: "https://farcaster.xyz/hqc",
    external: true,
    icon: <SiFarcaster className="size-5 text-[#855DFF]" aria-hidden />,
  },
  {
    label: "Discord",
    value: "bqrbase",
    valuePrefix: "Username:",
    description: "Find BaseQuest on Discord as bqrbase.",
    icon: <SiDiscord className="size-5 text-[#5865F2]" aria-hidden />,
    cta: {
      label: "Join Discord",
      href: DISCORD_INVITE_URL,
    },
  },
  {
    label: "Email",
    value: "support@basequest.online",
    description: "Reach the BaseQuest team for support and inquiries.",
    href: "mailto:support@basequest.online",
    icon: (
      <span className="text-sm font-semibold text-cyan-100" aria-hidden>
        @
      </span>
    ),
  },
];

export default function ContactPage() {
  return (
    <PageShell>
      <section className="text-center sm:text-left">
        <p className={ui.sectionHeading}>Support</p>
        <h1 className={ui.pageTitle}>Contact Us</h1>
        <p className={ui.pageSubtitle}>
          Reach BaseQuest through official channels. For product support, email
          is the best place to start.
        </p>
      </section>

      <section>
        <div className={ui.sectionHeaderWrap}>
          <p className={ui.sectionHeading}>Channels</p>
          <h2 className={ui.sectionTitle}>Official links</h2>
        </div>

        <div className={ui.gridCards}>
          {CONTACT_CARDS.map((card) => {
            const content = (
              <>
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
                    {card.icon}
                  </div>
                  <div className="min-w-0">
                    <p className={ui.statLabel}>{card.label}</p>
                    <p className="mt-2 break-words font-sans text-lg font-bold text-white">
                      {card.valuePrefix ? (
                        <>
                          <span className="font-semibold text-white/55">
                            {card.valuePrefix}{" "}
                          </span>
                          {card.value}
                        </>
                      ) : (
                        card.value
                      )}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-white/55">
                  {card.description}
                </p>
                {card.cta?.href ? (
                  <a
                    href={card.cta.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${ui.secondaryButton} mt-4 inline-flex w-full items-center justify-center`}
                  >
                    {card.cta.label}
                  </a>
                ) : null}
              </>
            );

            if (!card.href) {
              return (
                <GlassPanel key={card.label} className="p-5 sm:p-6">
                  {content}
                </GlassPanel>
              );
            }

            return (
              <a
                key={card.label}
                href={card.href}
                target={card.external ? "_blank" : undefined}
                rel={card.external ? "noopener noreferrer" : undefined}
                className="block h-full"
              >
                <GlassPanel interactive className="h-full p-5 sm:p-6">
                  {content}
                </GlassPanel>
              </a>
            );
          })}
        </div>
      </section>
    </PageShell>
  );
}
