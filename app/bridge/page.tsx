import BridgePage from "@/components/bridge/BridgePage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bridge | BaseQuest Rewards",
  description:
    "Bridge assets to Base Mainnet from Ethereum, Arbitrum, Optimism, or Polygon.",
};

export default function BridgeRoute() {
  return <BridgePage />;
}
