import { base } from "viem/chains";
import type { Config } from "wagmi";
import { getAccount, switchChain } from "wagmi/actions";

/** Shown when the user rejects (or fails) switching to Base Mainnet. */
export const BASE_MAINNET_REQUIRED_MESSAGE =
  "Please switch your wallet to Base Mainnet.";

export class BaseMainnetSwitchRejectedError extends Error {
  constructor(message = BASE_MAINNET_REQUIRED_MESSAGE) {
    super(message);
    this.name = "BaseMainnetSwitchRejectedError";
  }
}

export const BASE_MAINNET_CHAIN_ID = base.id;

type SwitchChainAsync = (args: { chainId: number }) => Promise<unknown>;

/**
 * Ensure the connected wallet is on Base Mainnet (8453) before any write.
 * Uses the provided switchChainAsync (hook) or wagmi/actions switchChain.
 * Waits until the active chain is 8453 before returning.
 */
export async function ensureBaseMainnet(params: {
  config: Config;
  currentChainId?: number;
  switchChainAsync?: SwitchChainAsync;
}): Promise<typeof base.id> {
  const active =
    getAccount(params.config).chainId ?? params.currentChainId ?? 0;

  if (active === base.id) {
    return base.id;
  }

  const switchChainAsync =
    params.switchChainAsync ??
    ((args: { chainId: number }) => switchChain(params.config, args));

  try {
    await switchChainAsync({ chainId: base.id });
  } catch {
    throw new BaseMainnetSwitchRejectedError();
  }

  // Wait until wagmi reports Base Mainnet (wallet UI can lag briefly).
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const chainId = getAccount(params.config).chainId;
    if (chainId === base.id) {
      return base.id;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  if (getAccount(params.config).chainId === base.id) {
    return base.id;
  }

  throw new BaseMainnetSwitchRejectedError();
}

export function isBaseMainnetSwitchRejected(
  error: unknown,
): error is BaseMainnetSwitchRejectedError {
  return (
    error instanceof BaseMainnetSwitchRejectedError ||
    (error instanceof Error && error.message === BASE_MAINNET_REQUIRED_MESSAGE)
  );
}
