import GenesisPage from "@/components/genesis/GenesisPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BaseQuest Genesis | BaseQuest",
  description:
    "The official Genesis NFT collection of the BaseQuest ecosystem on Base.",
};

export default function GenesisRoute() {
  return <GenesisPage />;
}
