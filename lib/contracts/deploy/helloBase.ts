import {
  HELLO_BASE_ABI,
  HELLO_BASE_BYTECODE,
} from "@/lib/contracts/abi/HelloBase";
import { base, baseSepolia } from "viem/chains";
import type { Config } from "wagmi";
import { deployContract, waitForTransactionReceipt } from "wagmi/actions";
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

const SUPPORTED_CHAIN_IDS = [base.id, baseSepolia.id] as const;
type SupportedChainId = (typeof SUPPORTED_CHAIN_IDS)[number];

function isSupportedChainId(chainId: number): chainId is SupportedChainId {
  return (SUPPORTED_CHAIN_IDS as readonly number[]).includes(chainId);
}

export function getBaseScanAddressUrl(
  contractAddress: string,
  chainId: number,
): string {
  if (chainId === baseSepolia.id) {
    return `https://sepolia.basescan.org/address/${contractAddress}`;
  }

  return `https://basescan.org/address/${contractAddress}`;
}

function getErrorMessage(error: unknown): string {
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
 */
export async function deployHelloBase(
  params: HelloBaseDeployParams,
): Promise<HelloBaseDeployResult> {
  const chainId = params.chainId ?? base.id;

  if (!isSupportedChainId(chainId)) {
    return {
      ok: false,
      status: "error",
      message: "Switch to Base or Base Sepolia to deploy HelloBase.",
    };
  }

  try {
    const hash = await deployContract(params.config, {
      abi: HELLO_BASE_ABI,
      bytecode: HELLO_BASE_BYTECODE,
      chainId,
      ...(params.dataSuffix ? { dataSuffix: params.dataSuffix } : {}),
    });

    const receipt = await waitForTransactionReceipt(params.config, {
      hash,
      confirmations: 1,
    });

    const contractAddress = receipt.contractAddress;
    if (!contractAddress) {
      return {
        ok: false,
        status: "error",
        message: "Deployment confirmed but no contract address was returned.",
      };
    }

    if (receipt.status !== "success") {
      return {
        ok: false,
        status: "error",
        message: "Deployment transaction reverted.",
      };
    }

    return {
      ok: true,
      status: "deployed",
      contractAddress,
      txHash: hash,
      chainId,
    };
  } catch (error) {
    console.error("[deployHelloBase]", error);
    return {
      ok: false,
      status: "error",
      message: getErrorMessage(error),
    };
  }
}
