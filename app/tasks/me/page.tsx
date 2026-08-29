import ShareRewardsCard from "@/components/task2earn/ShareRewardsCard";
import Task2EarnShell from "@/components/task2earn/Task2EarnShell";
import {
  buildMiniAppEmbedTags,
  canonicalShareRewardsImageUrl,
  canonicalShareRewardsUrl,
} from "@/lib/miniapp/share";
import type { Metadata } from "next";

const SHARE_REWARDS_URL = canonicalShareRewardsUrl();
const SHARE_REWARDS_IMAGE = canonicalShareRewardsImageUrl();

export const metadata: Metadata = {
  alternates: { canonical: SHARE_REWARDS_URL },
  openGraph: {
    url: SHARE_REWARDS_URL,
    images: [{ url: SHARE_REWARDS_IMAGE, width: 1200, height: 800 }],
  },
  twitter: {
    card: "summary_large_image",
    images: [SHARE_REWARDS_IMAGE],
  },
  other: buildMiniAppEmbedTags({
    url: SHARE_REWARDS_URL,
    buttonTitle: "Open Share Rewards",
    imageUrl: SHARE_REWARDS_IMAGE,
  }),
};

export default function TaskStatsPage() {
  return (
    <Task2EarnShell showUnfundedNotice={false}>
      <ShareRewardsCard />
    </Task2EarnShell>
  );
}
