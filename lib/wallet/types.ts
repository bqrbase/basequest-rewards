import type { Address, Hash, Hex } from "viem";
import type { Config, Connector } from "wagmi";
import type { WalletHost } from "@/lib/wagmi";

export type { WalletHost };

export type WalletType =
  | "farcaster"
  | "baseAccount"
  | "injected"
  | "coinbase"
  | "walletConnect"
  | "unknown";

export type WalletCapabilities = {
  walletSendCalls: boolean;
  walletGetCallsStatus: boolean;
  ethSendTransaction: boolean;
  switchChain: boolean;
  personalSign: boolean;
  eip5792: boolean;
  smartWallet: boolean;
};

export type ProviderSnapshot = {
  host: WalletHost;
  walletType: WalletType;
  connectorId: string | null;
  connectorType: string | null;
  address: Address | null;
  chainId: number | null;
  capabilities: WalletCapabilities;
};

export type WalletCall = {
  to: Address;
  data?: Hex;
  value?: Hex | bigint;
};

export type SendCallsCapabilities = Record<string, unknown>;

export type WalletTxResult = {
  hash: Hash | null;
  callsId: string | null;
  method: "wallet_sendCalls" | "eth_sendTransaction" | "writeContract" | "deployContract";
};

export type WalletRequestClient = {
  request: (args: {
    method: string;
    params?: readonly unknown[];
  }) => Promise<unknown>;
  account?: { address?: Address };
};

export type ResolveConnectorsParams = {
  connectors: readonly Connector[];
  host: WalletHost;
  lastConnectorId?: string | null;
};

export type WalletManagerContext = {
  config: Config;
  host: WalletHost;
};
