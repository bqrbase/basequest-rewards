import PageShell from "@/components/PageShell";
import WalletScoreDashboard from "@/components/wallet-score/WalletScoreDashboard";
import { buildMiniAppEmbedTags, canonicalScoreShareImageUrl, canonicalScoreUrl } from "@/lib/miniapp/share";
import type { Metadata } from "next";

const SCORE_URL = canonicalScoreUrl();
const SCORE_IMAGE = canonicalScoreShareImageUrl();

export const metadata: Metadata = {
  title: "Base Wallet Score | BaseQuest Rewards",
  description:
    "Premium Base wallet analytics dashboard — score, portfolio, activity, and insights.",
  alternates: { canonical: SCORE_URL },
  openGraph: {
    url: SCORE_URL,
    images: [{ url: SCORE_IMAGE, width: 1200, height: 800 }],
  },
  twitter: {
    card: "summary_large_image",
    images: [SCORE_IMAGE],
  },
  other: buildMiniAppEmbedTags({
    url: SCORE_URL,
    buttonTitle: "Check Score",
    imageUrl: SCORE_IMAGE,
  }),
};

export default function BaseWalletScorePage() {
  return (
    <PageShell>
      <WalletScoreDashboard />
    </PageShell>
  );
}
