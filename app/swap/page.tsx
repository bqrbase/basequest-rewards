import SwapPage from "@/components/swap/SwapPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Swap | BaseQuest Rewards",
  description:
    "Swap tokens on Base Mainnet with live LI.FI routing in BaseQuest Rewards.",
};

export default function SwapRoute() {
  return <SwapPage />;
}
