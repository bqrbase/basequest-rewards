import {
  HELLO_BASE_ABI,
  HELLO_BASE_BYTECODE,
} from "@/lib/contracts/abi/HelloBase";
import {
  collectDeployWalletDiagnostics,
  executeDeployContract,
} from "@/lib/wallet/TransactionManager";
import { resolveHostFromConfig } from "@/lib/wallet/resolveHostFromConfig";
import { extractProviderRejection, isWalletError } from "@/lib/wallet/Errors";
import { walletLogger } from "@/lib/wallet/logger";
import { base } from "viem/chains";
import type { Config } from "wagmi";
import type { Address, Hash, Hex } from "viem";

export type HelloBaseDeployParams = {
  config: Config;
  chainId?: number;
  /** Optional ERC-8021 / builder attribution suffix. */
  dataSuffix?: Hex;
};

export type HelloBaseDeploySuccess = {
  ok: true;
  status: "deployed";
  contractAddress: Address;
  txHash: Hash;
  chainId: number;
};

export type HelloBaseDeployFailure = {
  ok: false;
  status: "error";
  message: string;
};

export type HelloBaseDeployResult =
  | HelloBaseDeploySuccess
  | HelloBaseDeployFailure;

const BASE_MAINNET_CHAIN_ID = base.id;

function isBaseMainnet(chainId: number): boolean {
  return chainId === BASE_MAINNET_CHAIN_ID;
}

export function getBaseScanAddressUrl(
  contractAddress: string,
  _chainId?: number,
): string {
  return `https://basescan.org/address/${contractAddress}`;
}

function getErrorMessage(error: unknown): string {
  if (isWalletError(error) && error.message) {
    return error.message;
  }
  if (error instanceof Error && error.message) {
    if (/user rejected|denied|rejected the request/i.test(error.message)) {
      return "Transaction was rejected in your wallet.";
    }
    return error.message;
  }
  return String(error);
}

/**
 * Deploy HelloBase with the connected wallet and wait for confirmation.
 * Base Mainnet (8453) only.
 */
export async function deployHelloBase(
  params: HelloBaseDeployParams,
): Promise<HelloBaseDeployResult> {
  const chainId = params.chainId ?? base.id;

  if (!isBaseMainnet(chainId)) {
    return {
      ok: false,
      status: "error",
      message: "Switch to Base Mainnet to deploy HelloBase.",
    };
  }

  try {
    const host = resolveHostFromConfig(params.config);
    const diagnostics = await collectDeployWalletDiagnostics({
      config: params.config,
      host,
      chainId,
    });
    walletLogger.debug("deployHelloBase-diagnostics", diagnostics);

    const result = await executeDeployContract({
      config: params.config,
      host,
      chainId,
      abi: HELLO_BASE_ABI,
      bytecode: HELLO_BASE_BYTECODE,
      ...(params.dataSuffix ? { dataSuffix: params.dataSuffix } : {}),
    });

    const contractAddress = result.contractAddress;
    if (!contractAddress) {
      return {
        ok: false,
        status: "error",
        message: "Deployment confirmed but no contract address was returned.",
      };
    }

    return {
      ok: true,
      status: "deployed",
      contractAddress,
      txHash: result.hash as Hash,
      chainId,
    };
  } catch (error) {
    walletLogger.error("deployHelloBase-provider-rejection", {
      rejection: extractProviderRejection(error),
    });
    console.error("[deployHelloBase]", error);
    return {
      ok: false,
      status: "error",
      message: getErrorMessage(error),
    };
  }
}
