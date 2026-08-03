import { base } from "viem/chains";

export const WALLET_REQUIRED_CHAIN_ID = base.id;

export const LAST_CONNECTOR_STORAGE_KEY = "bq.wallet.lastConnectorId";

export const SEND_CALLS_VERSIONS = ["2.0.0", "1.0"] as const;

export const CAPABILITY_CACHE_TTL_MS = 5 * 60_000;

export const RECEIPT_TIMEOUT_MS = 120_000;

export const DEFAULT_CAPABILITIES = {
  walletSendCalls: false,
  walletGetCallsStatus: false,
  ethSendTransaction: true,
  switchChain: true,
  personalSign: true,
  eip5792: false,
  smartWallet: false,
} as const;
