import TokenPage from "@/components/token/TokenPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BQR Token | BaseQuest Rewards",
  description:
    "BaseQuest Rewards (BQR) token details on Base Mainnet — contract address, supply, and explorer links.",
};

export default function TokenRoute() {
  return <TokenPage />;
}
