import type { Connector } from "wagmi";
import { FARCASTER_MINI_APP_CONNECTOR_ID } from "@/lib/miniapp/constants";
import type { WalletHost } from "@/lib/wagmi";
import { LAST_CONNECTOR_STORAGE_KEY } from "@/lib/wallet/constants";
import type { ResolveConnectorsParams } from "@/lib/wallet/types";

function findConnector(
  connectors: readonly Connector[],
  predicate: (connector: Connector) => boolean,
): Connector | undefined {
  return connectors.find(predicate);
}

function isFarcasterConnector(connector: Connector): boolean {
  return (
    connector.id === FARCASTER_MINI_APP_CONNECTOR_ID ||
    connector.type === "farcasterMiniApp" ||
    connector.type === "farcasterFrame"
  );
}

function isBaseAccountConnector(connector: Connector): boolean {
  return connector.id === "baseAccount" || connector.type === "baseAccount";
}

function isCoinbaseConnector(connector: Connector): boolean {
  return (
    connector.id === "coinbaseWalletSDK" ||
    connector.id === "coinbaseWallet" ||
    connector.type === "coinbaseWallet"
  );
}

function readLastConnectorId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage.getItem(LAST_CONNECTOR_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function rememberConnectorId(connectorId: string): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(LAST_CONNECTOR_STORAGE_KEY, connectorId);
  } catch {
    // ignore quota / privacy mode
  }
}

export function clearRememberedConnectorId(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(LAST_CONNECTOR_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Single connector preference implementation for all hosts.
 */
export function resolvePreferredConnector(
  params: ResolveConnectorsParams,
): Connector | undefined {
  const { connectors, host } = params;
  const lastId = params.lastConnectorId ?? readLastConnectorId();

  if (host === "baseApp") {
    return findConnector(connectors, isBaseAccountConnector);
  }

  if (host === "farcaster") {
    return findConnector(connectors, isFarcasterConnector);
  }

  // Browser: prefer previously connected connector when still registered.
  if (lastId) {
    const last = findConnector(connectors, (c) => c.id === lastId);
    if (last) {
      return last;
    }
  }

  return (
    findConnector(connectors, (c) => c.id === "injected") ??
    findConnector(connectors, isCoinbaseConnector) ??
    findConnector(connectors, (c) => c.id === "walletConnect")
  );
}

/** @deprecated Use resolvePreferredConnector — kept as stable façade. */
export function getPreferredConnectorForHost(
  connectors: readonly Connector[],
  host: WalletHost,
): Connector | undefined {
  return resolvePreferredConnector({ connectors, host });
}
