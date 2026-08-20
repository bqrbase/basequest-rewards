import type { Abi, Address, Hash, Hex } from "viem";
import type { Config, Connector } from "wagmi";
import {
  estimateGas,
  getAccount,
  getConnectorClient,
  getPublicClient,
  getTransactionReceipt,
  getWalletClient,
  readContract,
  waitForTransactionReceipt,
} from "wagmi/actions";
import { WalletError, toWalletError } from "@/lib/wallet/Errors";
import type { WalletRequestClient } from "@/lib/wallet/types";

export async function getConnectedAddress(
  config: Config,
): Promise<Address | null> {
  return getAccount(config).address ?? null;
}

export function getActiveConnector(config: Config): Connector | undefined {
  return getAccount(config).connector;
}

export async function getHostWalletRequestClient(params: {
  config: Config;
  chainId?: number;
  connector?: Connector;
}): Promise<WalletRequestClient> {
  const connector =
    params.connector ?? getAccount(params.config).connector;
  try {
    return (await getConnectorClient(params.config, {
      chainId: params.chainId,
      connector,
    })) as WalletRequestClient;
  } catch (error) {
    throw new WalletError(
      "PROVIDER_UNAVAILABLE",
      "Wallet provider is unavailable. Reconnect and try again.",
      error,
    );
  }
}

export async function getHostWalletClient(params: {
  config: Config;
  chainId?: number;
  account?: Address;
}) {
  const accountState = getAccount(params.config);
  const client = await getWalletClient(params.config, {
    chainId: params.chainId,
    account: params.account ?? accountState.address,
    connector: accountState.connector,
  });
  if (!client) {
    throw new WalletError(
      "WALLET_NOT_CONNECTED",
      "Connect your wallet to continue.",
    );
  }
  return client;
}

export function getHostPublicClient(params: {
  config: Config;
  chainId?: number;
}) {
  return getPublicClient(params.config, { chainId: params.chainId });
}

export function requireConnectedAddress(config: Config): Address {
  const address = getAccount(config).address;
  if (!address) {
    throw new WalletError(
      "WALLET_NOT_CONNECTED",
      "Connect your wallet to continue.",
    );
  }
  return address;
}

export async function waitForHostTransactionReceipt(params: {
  config: Config;
  hash: Hash;
  chainId?: number;
  confirmations?: number;
}) {
  try {
    return await waitForTransactionReceipt(params.config, {
      hash: params.hash,
      chainId: params.chainId,
      confirmations: params.confirmations ?? 1,
    });
  } catch (error) {
    throw toWalletError(error);
  }
}

export async function getHostTransactionReceipt(params: {
  config: Config;
  hash: Hash;
  chainId?: number;
}) {
  return getTransactionReceipt(params.config, {
    hash: params.hash,
    chainId: params.chainId,
  });
}

export async function readHostContract<T = unknown>(params: {
  config: Config;
  abi: Abi;
  address: Address;
  functionName: string;
  args?: readonly unknown[];
  chainId?: number;
  account?: Address;
}): Promise<T> {
  return (await readContract(params.config, {
    abi: params.abi,
    address: params.address,
    functionName: params.functionName,
    args: params.args as never,
    chainId: params.chainId,
    account: params.account,
  })) as T;
}

export async function estimateHostGas(params: {
  config: Config;
  to?: Address;
  data?: Hex;
  value?: bigint;
  account?: Address;
  chainId?: number;
}) {
  try {
    return await estimateGas(params.config, {
      to: params.to,
      data: params.data,
      value: params.value,
      account: params.account,
      chainId: params.chainId,
    });
  } catch (error) {
    throw toWalletError(error);
  }
}
