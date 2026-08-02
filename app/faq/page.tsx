import FaqAccordion, {
  type FaqItem,
} from "@/components/static/FaqAccordion";
import PageShell from "@/components/PageShell";
import { ui } from "@/lib/ui-styles";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Frequently Asked Questions | BaseQuest Rewards",
  description:
    "Frequently asked questions about BaseQuest — XP, Genesis NFT, wallet connection, BQR token, rewards, and support.",
  openGraph: {
    title: "Frequently Asked Questions | BaseQuest Rewards",
    description:
      "Frequently asked questions about BaseQuest — XP, Genesis NFT, wallet connection, BQR token, rewards, and support.",
    url: "/faq",
  },
};

const linkClassName =
  "text-cyan-200/90 underline decoration-cyan-200/30 underline-offset-2 hover:text-white";

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "What is BaseQuest?",
    answer: (
      <p>
        BaseQuest is a gamified platform on Base where users complete on-chain
        and community quests to earn XP, achievements and future ecosystem
        rewards.
      </p>
    ),
  },
  {
    question: "Is BaseQuest free?",
    answer: (
      <>
        <p>Yes.</p>
        <p>
          Connecting a wallet and using BaseQuest is completely free. Only
          blockchain transactions may require normal Base network gas fees.
        </p>
      </>
    ),
  },
  {
    question: "How do I earn XP?",
    answer: (
      <p>
        You earn XP by completing daily quests, on-chain activities, community
        challenges and future Genesis-exclusive quests.
      </p>
    ),
  },
  {
    question: "What is the Genesis NFT?",
    answer: (
      <>
        <p>
          BaseQuest Genesis is the founding NFT collection of the BaseQuest
          ecosystem. Genesis holders receive exclusive benefits including:
        </p>
        <ul className="list-disc space-y-1.5 pl-5 marker:text-cyan-200/50">
          <li>20% XP Bonus</li>
          <li>Exclusive quests</li>
          <li>Future community rewards</li>
          <li>Priority access to new features</li>
        </ul>
      </>
    ),
  },
  {
    question: "How do I buy a Genesis NFT?",
    answer: (
      <p>
        Genesis NFTs can be purchased on OpenSea or received through official
        BaseQuest campaigns. Learn more on the{" "}
        <Link href="/genesis" className={linkClassName}>
          Genesis
        </Link>{" "}
        page.
      </p>
    ),
  },
  {
    question: "Why do I need to connect my wallet?",
    answer: (
      <p>
        Your wallet is used to identify your on-chain activity and securely
        track your quest progress and rewards.
      </p>
    ),
  },
  {
    question: "Does connecting my wallet give BaseQuest access to my funds?",
    answer: (
      <>
        <p>No.</p>
        <p>
          Connecting a wallet only allows BaseQuest to read your public wallet
          address. BaseQuest cannot move your assets or tokens. Any blockchain
          transaction requires your explicit approval.
        </p>
      </>
    ),
  },
  {
    question: "Is there a BaseQuest token?",
    answer: (
      <p>
        Yes. BaseQuest includes the BQR token as part of the ecosystem. See the{" "}
        <Link href="/token" className={linkClassName}>
          BQR Token
        </Link>{" "}
        page for details.
      </p>
    ),
  },
  {
    question: "Will there be future rewards?",
    answer: (
      <p>
        Yes. Future campaigns, Genesis holder benefits and ecosystem rewards
        will be announced through official BaseQuest channels.
      </p>
    ),
  },
  {
    question: "Where can I get support?",
    answer: (
      <>
        <p>
          Visit the{" "}
          <Link href="/contact" className={linkClassName}>
            Contact
          </Link>{" "}
          page or reach us through:
        </p>
        <ul className="list-disc space-y-1.5 pl-5 marker:text-cyan-200/50">
          <li>X</li>
          <li>Farcaster</li>
          <li>Discord</li>
          <li>Email</li>
        </ul>
      </>
    ),
  },
];

export default function FaqPage() {
  return (
    <PageShell>
      <section className="text-center sm:text-left">
        <p className={ui.sectionHeading}>Help</p>
        <h1 className={ui.pageTitle}>Frequently Asked Questions</h1>
        <p className={ui.pageSubtitle}>
          Everything you need to know about BaseQuest.
        </p>
      </section>

      <section>
        <div className={ui.sectionHeaderWrap}>
          <p className={ui.sectionHeading}>FAQ</p>
          <h2 className={ui.sectionTitle}>Common questions</h2>
        </div>
        <FaqAccordion items={FAQ_ITEMS} />
      </section>
    </PageShell>
  );
}
