import RewardsPage from "@/components/rewards/RewardsPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Claim Rewards | BaseQuest Rewards",
  description:
    "Claim pending BQR rewards from BaseQuest Merkle campaigns on Base Mainnet.",
};

export default function RewardsRoute() {
  return <RewardsPage />;
}
