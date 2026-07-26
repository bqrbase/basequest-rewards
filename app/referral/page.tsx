import ReferralPage from "@/components/referrals/ReferralPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Referrals | BaseQuest Rewards",
  description:
    "Invite builders to BaseQuest Rewards. Earn XP when friends connect and complete onboarding.",
};

export default function ReferralRoute() {
  return <ReferralPage />;
}
