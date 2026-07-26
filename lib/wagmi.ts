import {
  cookieStorage,
  createConfig,
  createStorage,
  http,
  type Config,
  type CreateConnectorFn,
} from "wagmi";
import {
  arbitrum,
  base,
  mainnet,
  optimism,
  polygon,
} from "wagmi/chains";
import {
  baseAccount,
  coinbaseWallet,
  injected,
  walletConnect,
} from "wagmi/connectors";
import type { AppEnvironment } from "@/lib/miniapp/environment";

export type WalletHost = "browser" | "farcaster" | "baseApp";

const APP_NAME = "BaseQuest Rewards";

/** Chains needed for Base app writes + Bridge to Base (LI.FI). */
const SUPPORTED_CHAINS = [base, mainnet, arbitrum, optimism, polygon] as const;

function createWalletConnectConnector() {
  return walletConnect({
    projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "",
    showQrModal: true,
  });
}

function createCoinbaseWalletConnector() {
  return coinbaseWallet({
    appName: APP_NAME,
  });
}

function createSharedConfig(connectors: CreateConnectorFn[]): Config {
  return createConfig({
    ssr: true,
    storage: createStorage({
      storage: cookieStorage,
    }),
    chains: SUPPORTED_CHAINS,
    connectors,
    transports: {
      [base.id]: http(),
      [mainnet.id]: http(),
      [arbitrum.id]: http(),
      [optimism.id]: http(),
      [polygon.id]: http(),
    },
  });
}

/**
 * Resolve which wallet host config to register.
 * Base App must never register farcasterMiniApp().
 */
export function resolveWalletHost(environment: AppEnvironment): WalletHost {
  if (environment.isBaseApp) {
    return "baseApp";
  }

  if (environment.isFarcasterClient) {
    return "farcaster";
  }

  return "browser";
}

/**
 * Browser connectors only — never loads @farcaster/miniapp-wagmi-connector.
 */
export function createBrowserWagmiConfig(): Config {
  return createSharedConfig([
    injected(),
    createCoinbaseWalletConnector(),
    createWalletConnectConnector(),
  ]);
}

/**
 * Base App connectors only — never loads or registers farcasterMiniApp().
 */
export function createBaseAppWagmiConfig(): Config {
  return createSharedConfig([
    baseAccount({ appName: APP_NAME }),
    createCoinbaseWalletConnector(),
    injected(),
    createWalletConnectConnector(),
  ]);
}

/**
 * Farcaster connectors — dynamically imports farcasterMiniApp so Base App
 * never evaluates that module during boot.
 */
export async function createFarcasterWagmiConfig(): Promise<Config> {
  const { farcasterMiniApp } = await import(
    "@farcaster/miniapp-wagmi-connector"
  );

  return createSharedConfig([
    farcasterMiniApp(),
    injected(),
    createCoinbaseWalletConnector(),
    createWalletConnectConnector(),
  ]);
}

/**
 * Environment-aware wagmi config factory.
 * - Browser: injected, coinbaseWallet, walletConnect
 * - Farcaster: farcasterMiniApp, injected, coinbaseWallet, walletConnect
 * - Base App: baseAccount, coinbaseWallet, injected, walletConnect
 */
export async function createWagmiConfig(host: WalletHost): Promise<Config> {
  if (host === "baseApp") {
    return createBaseAppWagmiConfig();
  }

  if (host === "farcaster") {
    return createFarcasterWagmiConfig();
  }

  return createBrowserWagmiConfig();
}

/**
 * SSR-safe default config without farcasterMiniApp.
 * Client Providers replace this after host detection.
 */
export const wagmiConfig = createBrowserWagmiConfig();
