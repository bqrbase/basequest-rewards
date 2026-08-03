import { base } from "viem/chains";
import type { Config } from "wagmi";
import { getAccount, switchChain } from "wagmi/actions";
import { WALLET_REQUIRED_CHAIN_ID } from "@/lib/wallet/constants";
import { WalletError } from "@/lib/wallet/Errors";
import { walletLogger } from "@/lib/wallet/logger";

type SwitchChainAsync = (args: { chainId: number }) => Promise<unknown>;

/**
 * Canonical chain operations. All Base Mainnet gating goes through here.
 */
export async function getActiveChainId(config: Config): Promise<number | undefined> {
  return getAccount(config).chainId;
}

export async function ensureChain(params: {
  config: Config;
  chainId?: number;
  currentChainId?: number;
  switchChainAsync?: SwitchChainAsync;
}): Promise<number> {
  const target = params.chainId ?? WALLET_REQUIRED_CHAIN_ID;
  const active =
    getAccount(params.config).chainId ?? params.currentChainId ?? 0;

  if (active === target) {
    return target;
  }

  const switchFn =
    params.switchChainAsync ??
    ((args: { chainId: number }) => switchChain(params.config, args));

  walletLogger.debug("switch-chain", { from: active, to: target });

  try {
    await switchFn({ chainId: target });
  } catch (error) {
    throw new WalletError(
      "SWITCH_REJECTED",
      target === WALLET_REQUIRED_CHAIN_ID
        ? "Please switch your wallet to Base Mainnet."
        : `Please switch your wallet to the required network (${target}).`,
      error,
    );
  }

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const chainId = getAccount(params.config).chainId;
    if (chainId === target) {
      return target;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  if (getAccount(params.config).chainId === target) {
    return target;
  }

  throw new WalletError(
    "WRONG_CHAIN",
    target === WALLET_REQUIRED_CHAIN_ID
      ? "Please switch your wallet to Base Mainnet."
      : `Please switch your wallet to the required network (${target}).`,
  );
}

export async function ensureBaseMainnetChain(params: {
  config: Config;
  currentChainId?: number;
  switchChainAsync?: SwitchChainAsync;
}): Promise<typeof base.id> {
  return ensureChain({
    ...params,
    chainId: base.id,
  }) as Promise<typeof base.id>;
}

export function isSwitchRejectedError(error: unknown): boolean {
  return (
    (error instanceof WalletError &&
      (error.code === "SWITCH_REJECTED" || error.code === "WRONG_CHAIN")) ||
    (error instanceof Error &&
      error.message === "Please switch your wallet to Base Mainnet.")
  );
}
