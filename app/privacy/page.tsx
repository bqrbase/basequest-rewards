import PageShell from "@/components/PageShell";
import StaticSection from "@/components/static/StaticSection";
import { ui } from "@/lib/ui-styles";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | BaseQuest Rewards",
  description:
    "Privacy Policy for BaseQuest Rewards — how wallet addresses, quest progress, XP, cookies, and third-party services are handled.",
  openGraph: {
    title: "Privacy Policy | BaseQuest Rewards",
    description:
      "Privacy Policy for BaseQuest Rewards — how wallet addresses, quest progress, XP, cookies, and third-party services are handled.",
    url: "/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <PageShell>
      <section className="text-center sm:text-left">
        <p className={ui.sectionHeading}>Legal</p>
        <h1 className={ui.pageTitle}>Privacy Policy</h1>
        <p className={ui.pageSubtitle}>
          This Privacy Policy explains what information BaseQuest Rewards
          processes and how it is used. Last updated: August 2, 2026.
        </p>
      </section>

      <StaticSection title="Wallet addresses">
        <p>
          When you connect a wallet, BaseQuest may process your public wallet
          address to display account state, detect onchain ownership (such as
          Genesis NFT holdings), sync progress, and attribute quest or reward
          activity.
        </p>
        <p>
          Wallet addresses are public blockchain identifiers. Connecting a
          wallet does not grant BaseQuest custody of your funds or private keys.
        </p>
      </StaticSection>

      <StaticSection title="Quest progress">
        <p>
          BaseQuest may store quest-related progress associated with your wallet
          address, including completed quests, check-in history, streaks, and
          related activity needed to operate rewards and leaderboards.
        </p>
        <p>
          Some progress may also be cached locally in your browser to improve
          responsiveness while you use the app.
        </p>
      </StaticSection>

      <StaticSection title="XP">
        <p>
          Experience points (XP) and related progression data may be stored and
          displayed to reflect your activity in BaseQuest. XP is an in-app
          engagement metric and is not a representation of money, equity, or
          guaranteed value.
        </p>
      </StaticSection>

      <StaticSection title="Cookies">
        <p>
          BaseQuest may use cookies or similar storage mechanisms for essential
          app functionality, such as X (Twitter) OAuth when you choose to connect
          X, and preferences that keep the product usable. Connecting a wallet
          does not create an ownership signature or authentication cookie.
        </p>
        <p>
          These mechanisms are used to operate the service, not to sell personal
          information.
        </p>
      </StaticSection>

      <StaticSection title="Third-party services">
        <p>
          BaseQuest may rely on third-party infrastructure and services to
          operate, including wallet providers, blockchain RPCs and indexers,
          hosting providers, analytics or infrastructure vendors, and social
          platforms such as X or Farcaster when you choose related features.
        </p>
        <p>
          Those services process data according to their own terms and privacy
          policies. Onchain activity you broadcast through your wallet is public
          by nature of blockchain networks.
        </p>
      </StaticSection>

      <StaticSection title="Data security">
        <p>
          We take reasonable technical and organizational measures to protect
          application data. No method of transmission or storage is completely
          secure, and you should use BaseQuest with standard wallet safety
          practices.
        </p>
        <p>
          Never share seed phrases or private keys with BaseQuest or any
          website, app, or support channel.
        </p>
      </StaticSection>

      <StaticSection title="User rights">
        <p>
          Depending on your jurisdiction, you may have rights related to access,
          correction, or deletion of certain personal data we control. Because
          some BaseQuest records are tied to public wallet activity and onchain
          events, not all information can be altered or erased.
        </p>
        <p>
          To ask a privacy-related question, contact{" "}
          <a
            href="mailto:support@basequest.online"
            className="text-cyan-200/90 underline decoration-cyan-200/30 underline-offset-2 hover:text-white"
          >
            support@basequest.online
          </a>
          .
        </p>
      </StaticSection>
    </PageShell>
  );
}
