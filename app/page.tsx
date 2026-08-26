import Dashboard from "@/components/Dashboard";
import {
  buildMiniAppEmbedTags,
  canonicalAppUrl,
  canonicalShareRewardsImageUrl,
} from "@/lib/miniapp/share";
import type { Metadata } from "next";

const APP_URL = canonicalAppUrl();
const SHARE_IMAGE = canonicalShareRewardsImageUrl();

export const metadata: Metadata = {
  alternates: { canonical: APP_URL },
  openGraph: {
    url: APP_URL,
    images: [{ url: SHARE_IMAGE, width: 1200, height: 800 }],
  },
  twitter: {
    card: "summary_large_image",
    images: [SHARE_IMAGE],
  },
  other: buildMiniAppEmbedTags({
    url: APP_URL,
    buttonTitle: "Open BaseQuest",
    imageUrl: SHARE_IMAGE,
  }),
};

export default function Home() {
  return <Dashboard />;
}
