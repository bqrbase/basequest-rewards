import type { Connector } from "wagmi";
import { FARCASTER_MINI_APP_CONNECTOR_ID } from "@/lib/miniapp/constants";
import type { AppEnvironment } from "@/lib/miniapp/environment";

function findConnector(
  connectors: readonly Connector[],
  predicate: (connector: Connector) => boolean,
): Connector | undefined {
  return connectors.find(predicate);
}

function getFarcasterMiniAppConnector(
  connectors: readonly Connector[],
): Connector | undefined {
  return findConnector(
    connectors,
    (connector) =>
      connector.id === FARCASTER_MINI_APP_CONNECTOR_ID ||
      connector.type === "farcasterMiniApp" ||
      connector.type === "farcasterFrame",
  );
}

function getBaseAppConnector(
  connectors: readonly Connector[],
): Connector | undefined {
  return (
    findConnector(
      connectors,
      (connector) =>
        connector.id === "baseAccount" || connector.type === "baseAccount",
    ) ??
    findConnector(
      connectors,
      (connector) =>
        connector.id === "coinbaseWalletSDK" ||
        connector.id === "coinbaseWallet",
    ) ??
    findConnector(connectors, (connector) => connector.id === "injected")
  );
}

function getBrowserConnector(
  connectors: readonly Connector[],
): Connector | undefined {
  return (
    findConnector(connectors, (connector) => connector.id === "injected") ??
    findConnector(
      connectors,
      (connector) =>
        connector.id === "coinbaseWalletSDK" ||
        connector.id === "coinbaseWallet",
    ) ??
    findConnector(connectors, (connector) => connector.id === "walletConnect")
  );
}

/**
 * Connector preference:
 * - Base App → baseAccount / Coinbase / injected Base provider (never farcasterMiniApp)
 * - Farcaster client → farcasterMiniApp (isFarcasterClient only)
 * - Browser → injected → Coinbase → WalletConnect
 */
export function getPreferredConnector(
  connectors: readonly Connector[],
  environment: AppEnvironment,
): Connector | undefined {
  if (environment.isBaseApp) {
    return getBaseAppConnector(connectors);
  }

  if (environment.isFarcasterClient) {
    return getFarcasterMiniAppConnector(connectors);
  }

  return getBrowserConnector(connectors);
}
