"use client";

import type { Config } from "wagmi";
import { connect, disconnect, getAccount, reconnect } from "wagmi/actions";
import { base } from "viem/chains";
import type { WalletHost } from "@/lib/wagmi";
import {
  clearRememberedConnectorId,
  rememberConnectorId,
  resolvePreferredConnector,
} from "@/lib/wallet/ConnectorResolver";
import { clearCapabilityCache } from "@/lib/wallet/ProviderResolver";
import { WalletError } from "@/lib/wallet/Errors";
import { walletLogger } from "@/lib/wallet/logger";
import { getConnectedAddress } from "@/lib/wallet/WalletClient";

export async function connectPreferredWallet(params: {
  config: Config;
  host: WalletHost;
  chainId?: number;
}): Promise<void> {
  const connector = resolvePreferredConnector({
    connectors: params.config.connectors,
    host: params.host,
  });

  if (!connector) {
    throw new WalletError(
      "PROVIDER_UNAVAILABLE",
      "No wallet connector available for this host.",
    );
  }

  walletLogger.info("connect", {
    host: params.host,
    connectorId: connector.id,
  });

  await connect(params.config, {
    connector,
    chainId: params.chainId ?? base.id,
  });
  rememberConnectorId(connector.id);
}

export async function disconnectWallet(params: {
  config: Config;
}): Promise<void> {
  clearCapabilityCache();
  clearRememberedConnectorId();
  walletLogger.info("disconnect");
  await disconnect(params.config);
}

export async function reconnectWallet(params: {
  config: Config;
}): Promise<void> {
  walletLogger.debug("reconnect");
  await reconnect(params.config);
  const account = getAccount(params.config);
  if (account.connector?.id) {
    rememberConnectorId(account.connector.id);
  }
}

export async function getWalletAddress(config: Config) {
  return getConnectedAddress(config);
}

export function getWalletConnectionStatus(config: Config) {
  const account = getAccount(config);
  return {
    status: account.status,
    address: account.address ?? null,
    chainId: account.chainId ?? null,
    connectorId: account.connector?.id ?? null,
    isConnected: account.isConnected,
  };
}
