import ProfileHub from "@/components/profile/ProfileHub";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profile | BaseQuest Rewards",
  description:
    "Your BaseQuest Rewards hub — wallet, XP, achievements, badges, and Base Wallet Score.",
};

export default function ProfilePage() {
  return <ProfileHub />;
}
