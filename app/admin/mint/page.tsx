import AdminMintPage from "@/components/admin/AdminMintPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Mint | BaseQuest Rewards",
  description: "Owner-only Genesis mint tool for BaseQuest Rewards.",
};

export default function AdminMintRoute() {
  return <AdminMintPage />;
}
