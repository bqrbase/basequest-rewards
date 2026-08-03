import type { Connector } from "wagmi";
import type { AppEnvironment } from "@/lib/miniapp/environment";
import { resolveWalletHost } from "@/lib/wagmi";
import { resolvePreferredConnector } from "@/lib/wallet/ConnectorResolver";

/**
 * Stable façade for existing call sites.
 * Phase 1: delegates to ConnectorResolver (single preference implementation).
 */
export function getPreferredConnector(
  connectors: readonly Connector[],
  environment: AppEnvironment,
): Connector | undefined {
  return resolvePreferredConnector({
    connectors,
    host: resolveWalletHost(environment),
  });
}
