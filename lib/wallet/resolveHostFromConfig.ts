import type { Config } from "wagmi";
import { FARCASTER_MINI_APP_CONNECTOR_ID } from "@/lib/miniapp/constants";
import type { WalletHost } from "@/lib/wagmi";

/**
 * Infer wallet host from registered connectors (host-scoped configs).
 */
export function resolveHostFromConfig(config: Config): WalletHost {
  const connectors = config.connectors;

  if (connectors.length === 1) {
    const only = connectors[0];
    if (
      only.id === FARCASTER_MINI_APP_CONNECTOR_ID ||
      only.type === "farcasterMiniApp" ||
      only.type === "farcasterFrame"
    ) {
      return "farcaster";
    }
    if (only.id === "baseAccount" || only.type === "baseAccount") {
      return "baseApp";
    }
  }

  const hasFarcaster = connectors.some(
    (c) =>
      c.id === FARCASTER_MINI_APP_CONNECTOR_ID ||
      c.type === "farcasterMiniApp" ||
      c.type === "farcasterFrame",
  );
  const hasBaseAccount = connectors.some(
    (c) => c.id === "baseAccount" || c.type === "baseAccount",
  );

  if (hasBaseAccount && !hasFarcaster) {
    return "baseApp";
  }
  if (hasFarcaster && !hasBaseAccount) {
    return "farcaster";
  }
  return "browser";
}
