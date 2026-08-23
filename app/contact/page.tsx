import GlassPanel from "@/components/GlassPanel";
import PageShell from "@/components/PageShell";
import { ui } from "@/lib/ui-styles";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  SiDiscord,
  SiInstagram,
  SiTelegram,
  SiTiktok,
} from "react-icons/si";

export const metadata: Metadata = {
  title: "Contact Us | BaseQuest Rewards",
  description:
    "Contact BaseQuest Rewards — email, TikTok, Instagram, Telegram, and Discord.",
  openGraph: {
    title: "Contact Us | BaseQuest Rewards",
    description:
      "Contact BaseQuest Rewards — email, TikTok, Instagram, Telegram, and Discord.",
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

const CONTACT_CARDS: ContactCard[] = [
  {
    label: "Email",
    value: "bqrbase@proton.me",
    description: "Reach the BaseQuest team for support and inquiries.",
    href: "mailto:bqrbase@proton.me",
    icon: (
      <span className="text-sm font-semibold text-cyan-100" aria-hidden>
        @
      </span>
    ),
  },
  {
    label: "TikTok",
    value: "@bqrbase",
    description: "Follow BaseQuest Rewards on TikTok.",
    href: "https://www.tiktok.com/@bqrbase",
    external: true,
    icon: <SiTiktok className="size-5 text-white" aria-hidden />,
  },
  {
    label: "Instagram",
    value: "@bqrbase",
    description: "Follow BaseQuest Rewards on Instagram.",
    href: "https://www.instagram.com/bqrbase",
    external: true,
    icon: <SiInstagram className="size-5 text-[#E4405F]" aria-hidden />,
  },
  {
    label: "Telegram",
    value: "@bqrbase",
    description: "Message BaseQuest Rewards on Telegram.",
    href: "https://t.me/bqrbase",
    external: true,
    icon: <SiTelegram className="size-5 text-[#26A5E4]" aria-hidden />,
  },
  {
    label: "Telegram Channel",
    value: "t.me/BaseQeustRewards",
    description: "Official BaseQuest Rewards Telegram channel.",
    href: "https://t.me/BaseQeustRewards",
    external: true,
    icon: <SiTelegram className="size-5 text-[#26A5E4]" aria-hidden />,
  },
  {
    label: "Telegram Group",
    value: "t.me/basequestrewards",
    description: "Join the BaseQuest Rewards Telegram group.",
    href: "https://t.me/basequestrewards",
    external: true,
    icon: <SiTelegram className="size-5 text-[#26A5E4]" aria-hidden />,
  },
  {
    label: "Discord Server",
    value: "discord.gg/qugm99bFd",
    description: "Join the official BaseQuest Rewards Discord server.",
    href: "https://discord.gg/qugm99bFd",
    external: true,
    icon: <SiDiscord className="size-5 text-[#5865F2]" aria-hidden />,
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
