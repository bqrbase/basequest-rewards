import PageShell from "@/components/PageShell";
import StaticSection from "@/components/static/StaticSection";
import { ui } from "@/lib/ui-styles";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | BaseQuest Rewards",
  description:
    "Terms of Service for BaseQuest Rewards — acceptance, user responsibilities, rewards and NFT disclaimers, and contact information.",
  openGraph: {
    title: "Terms of Service | BaseQuest Rewards",
    description:
      "Terms of Service for BaseQuest Rewards — acceptance, user responsibilities, rewards and NFT disclaimers, and contact information.",
    url: "/terms",
  },
};

export default function TermsPage() {
  return (
    <PageShell>
      <section className="text-center sm:text-left">
        <p className={ui.sectionHeading}>Legal</p>
        <h1 className={ui.pageTitle}>Terms of Service</h1>
        <p className={ui.pageSubtitle}>
          These Terms govern your use of BaseQuest Rewards. Last updated: August
          2, 2026.
        </p>
      </section>

      <StaticSection title="Acceptance of terms">
        <p>
          By accessing or using BaseQuest Rewards (including basequest.online
          and related Mini App surfaces), you agree to these Terms of Service.
          If you do not agree, do not use the service.
        </p>
        <p>
          We may update these Terms from time to time. Continued use after
          changes become available constitutes acceptance of the updated Terms.
        </p>
      </StaticSection>

      <StaticSection title="User responsibilities">
        <p>
          You are responsible for your wallet, devices, and the security of your
          credentials. You agree to use BaseQuest lawfully and not to abuse,
          disrupt, exploit, or attempt to manipulate quests, rewards, XP,
          leaderboards, or related systems.
        </p>
        <p>
          You must not use BaseQuest for fraud, spam, unauthorized automation,
          or any activity that harms other users or the integrity of the
          product.
        </p>
      </StaticSection>

      <StaticSection title="Rewards disclaimer">
        <p>
          XP, streaks, quests, leaderboard placement, and other in-app rewards
          are promotional engagement features. They may be changed, paused,
          limited, or discontinued at any time.
        </p>
        <p>
          Token or other reward distributions, if any, are not guaranteed, may
          be subject to eligibility rules and onchain conditions, and should not
          be treated as wages, investment returns, or entitlement to future
          value.
        </p>
      </StaticSection>

      <StaticSection title="NFT disclaimer">
        <p>
          NFTs associated with BaseQuest, including Genesis or badge-style
          collectibles, are digital collectibles. Ownership, utility, and any
          related benefits may change over time and are not guaranteed.
        </p>
        <p>
          NFTs do not represent equity, ownership in BaseQuest, profit rights, or
          any claim on company assets unless expressly stated in a separate
          legally binding instrument.
        </p>
      </StaticSection>

      <StaticSection title="No financial advice">
        <p>
          Nothing on BaseQuest constitutes financial, investment, legal, or tax
          advice. Cryptocurrency and NFT markets involve risk, including the
          possible loss of value. You are solely responsible for your decisions
          and for complying with applicable laws in your jurisdiction.
        </p>
      </StaticSection>

      <StaticSection title="Intellectual property">
        <p>
          BaseQuest names, branding, interface design, copy, and related
          materials are protected by applicable intellectual property laws.
          You may not copy, modify, distribute, or create derivative works from
          BaseQuest materials except as expressly permitted.
        </p>
        <p>
          Wallet-connected user content or onchain artifacts remain subject to
          the rights and licenses associated with those systems and networks.
        </p>
      </StaticSection>

      <StaticSection title="Contact information">
        <p>
          For questions about these Terms, contact{" "}
          <a
            href="mailto:support@basequest.online"
            className="text-cyan-200/90 underline decoration-cyan-200/30 underline-offset-2 hover:text-white"
          >
            support@basequest.online
          </a>
          .
        </p>
        <p>
          You can also reach the BaseQuest community through official channels
          listed on the{" "}
          <a
            href="/contact"
            className="text-cyan-200/90 underline decoration-cyan-200/30 underline-offset-2 hover:text-white"
          >
            Contact
          </a>{" "}
          page.
        </p>
      </StaticSection>
    </PageShell>
  );
}
