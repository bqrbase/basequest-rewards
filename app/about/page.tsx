import PageShell from "@/components/PageShell";
import StaticSection from "@/components/static/StaticSection";
import { ui } from "@/lib/ui-styles";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About BaseQuest | BaseQuest Rewards",
  description:
    "Learn about BaseQuest — a Base-first rewards and engagement app for quests, XP, Genesis holders, and community builders.",
  openGraph: {
    title: "About BaseQuest | BaseQuest Rewards",
    description:
      "Learn about BaseQuest — a Base-first rewards and engagement app for quests, XP, Genesis holders, and community builders.",
    url: "/about",
  },
};

export default function AboutPage() {
  return (
    <PageShell>
      <section className="text-center sm:text-left">
        <p className={ui.sectionHeading}>BaseQuest</p>
        <h1 className={ui.pageTitle}>About BaseQuest</h1>
        <p className={ui.pageSubtitle}>
          A Base-first rewards experience for builders, explorers, and the
          community growing onchain together.
        </p>
      </section>

      <StaticSection title="What is BaseQuest?">
        <p>
          BaseQuest is a rewards and engagement Mini App built for the Base
          ecosystem. Connect your wallet, complete quests, earn XP, track your
          streak, and unlock rewards as you explore Base.
        </p>
        <p>
          The product is designed mobile-first for Base App and Farcaster Mini
          App hosts, while remaining usable as a standard web experience at
          basequest.online.
        </p>
      </StaticSection>

      <StaticSection title="Mission">
        <p>
          Our mission is to make onchain participation on Base simple, fun, and
          rewarding. We help users discover useful actions — from daily
          check-ins to swaps, bridges, deployments, and community engagement —
          and recognize consistent contribution with clear progress and rewards.
        </p>
      </StaticSection>

      <StaticSection title="Vision">
        <p>
          We envision BaseQuest as a trusted home for Base ecosystem engagement:
          a place where newcomers can start, regulars can stay active, and
          Genesis holders can access exclusive experiences as the network grows.
        </p>
        <p>
          Over time, BaseQuest aims to connect quests, identity, analytics, and
          rewards into one cohesive Base-native product.
        </p>
      </StaticSection>

      <StaticSection title="Why Base was chosen">
        <p>
          Base was chosen because it is built for everyday onchain use —
          low fees, fast confirmations, and a growing ecosystem of apps,
          creators, and communities.
        </p>
        <p>
          BaseQuest prioritizes Base first so rewards, wallet features, and
          quests feel native to the network users already use.
        </p>
      </StaticSection>

      <StaticSection title="Genesis NFT Collection">
        <p>
          The BaseQuest Genesis NFT collection represents early support for the
          BaseQuest ecosystem. Genesis holders may receive exclusive quest
          visibility, XP bonuses, and future holder-focused experiences as they
          become available.
        </p>
        <p>
          Genesis ownership is detected onchain. Holding Genesis is never
          required to explore BaseQuest, but it unlocks additional recognition
          for founding supporters.
        </p>
      </StaticSection>

      <StaticSection title="Community-first philosophy">
        <p>
          BaseQuest is built in public with a community-first mindset. Progress
          should feel fair, transparent, and welcoming — whether you are
          checking in for the first time or shipping onchain every day.
        </p>
        <p>
          We focus on clear UX, honest reward mechanics, and open channels on X
          and Farcaster so builders and users can grow with the product.
        </p>
      </StaticSection>
    </PageShell>
  );
}
