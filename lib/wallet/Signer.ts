import type { Address, Hex, SignableMessage } from "viem";
import type { Config } from "wagmi";
import { signMessage } from "wagmi/actions";
import { WalletError } from "@/lib/wallet/Errors";
import { walletLogger } from "@/lib/wallet/logger";

/**
 * Single signing entry point for the client wallet layer.
 */
export async function signWalletMessage(params: {
  config: Config;
  address: Address;
  message: SignableMessage;
}): Promise<Hex> {
  try {
    walletLogger.debug("sign-message", { address: params.address });
    return await signMessage(params.config, {
      account: params.address,
      message: params.message,
    });
  } catch (error) {
    throw new WalletError(
      "AUTHENTICATION_FAILED",
      error instanceof Error
        ? error.message
        : "Failed to sign wallet ownership message.",
      error,
    );
  }
}
