import {
  BASEQUEST_GENESIS_ABI,
  BASEQUEST_GENESIS_ADDRESS,
  BASEQUEST_GENESIS_MAX_SUPPLY,
} from "@/lib/contracts/abi/BaseQuestGenesis";
import {
  BASE_MAINNET_REQUIRED_MESSAGE,
  ensureBaseMainnet,
  isBaseMainnetSwitchRejected,
} from "@/lib/wallet/ensureBaseMainnet";
import {
  getAddress,
  isAddress,
  type Address,
  type Hash,
  type Hex,
} from "viem";
import type { Config } from "wagmi";
import {
  readContract,
  waitForTransactionReceipt,
  writeContract,
} from "wagmi/actions";

export type MintGenesisTokenParams = {
  config: Config;
  chainId?: number;
  /** Connected owner wallet that signs the mint transaction. */
  ownerAddress: Address;
  recipient: Address;
  tokenId: bigint;
  /** Existing `mint` always mints 1 — amount must be 1. */
  amount?: bigint;
  data?: Hex;
  dataSuffix?: Hex;
};

export type MintGenesisTokenResult =
  | {
      ok: true;
      status: "minted";
      txHash: Hash;
      chainId: number;
      tokenId: bigint;
      amount: bigint;
      recipient: Address;
    }
  | {
      ok: false;
      status: "error";
      message: string;
    };

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Mint failed.";
}

/**
 * Owner-signed Genesis mint via the existing `mint(to, tokenId, data)` function.
 * Amount is fixed at 1 on-chain; callers may pass amount=1 for validation.
 */
export async function mintGenesisToken(
  params: MintGenesisTokenParams,
): Promise<MintGenesisTokenResult> {
  const amount = params.amount ?? 1n;

  if (!isAddress(params.recipient)) {
    return {
      ok: false,
      status: "error",
      message: "Invalid recipient address.",
    };
  }

  if (amount !== 1n) {
    return {
      ok: false,
      status: "error",
      message: "Amount must be 1 for the existing mint function.",
    };
  }

  if (params.tokenId < 1n || params.tokenId > BASEQUEST_GENESIS_MAX_SUPPLY) {
    return {
      ok: false,
      status: "error",
      message: `Token ID must be between 1 and ${BASEQUEST_GENESIS_MAX_SUPPLY.toString()}.`,
    };
  }

  const recipient = getAddress(params.recipient);
  const ownerAddress = getAddress(params.ownerAddress);
  const data = params.data ?? "0x";

  try {
    const chainId = await ensureBaseMainnet({
      config: params.config,
      currentChainId: params.chainId,
    });

    const alreadyExists = await readContract(params.config, {
      abi: BASEQUEST_GENESIS_ABI,
      address: BASEQUEST_GENESIS_ADDRESS,
      functionName: "exists",
      args: [params.tokenId],
      chainId,
    });

    if (alreadyExists) {
      return {
        ok: false,
        status: "error",
        message: `Token #${params.tokenId.toString()} already exists.`,
      };
    }

    const hash = await writeContract(params.config, {
      abi: BASEQUEST_GENESIS_ABI,
      address: BASEQUEST_GENESIS_ADDRESS,
      functionName: "mint",
      args: [recipient, params.tokenId, data],
      chainId,
      account: ownerAddress,
      ...(params.dataSuffix ? { dataSuffix: params.dataSuffix } : {}),
    });

    await waitForTransactionReceipt(params.config, {
      hash,
      confirmations: 1,
    });

    return {
      ok: true,
      status: "minted",
      txHash: hash,
      chainId,
      tokenId: params.tokenId,
      amount,
      recipient,
    };
  } catch (error) {
    if (isBaseMainnetSwitchRejected(error)) {
      return {
        ok: false,
        status: "error",
        message: BASE_MAINNET_REQUIRED_MESSAGE,
      };
    }

    return {
      ok: false,
      status: "error",
      message: getErrorMessage(error),
    };
  }
}

/** @deprecated Prefer `mintGenesisToken` with explicit recipient/tokenId. */
export async function mintGenesisTokenOne(
  params: {
    config: Config;
    chainId?: number;
    walletAddress: Address;
    dataSuffix?: Hex;
  },
): Promise<MintGenesisTokenResult> {
  return mintGenesisToken({
    config: params.config,
    chainId: params.chainId,
    ownerAddress: params.walletAddress,
    recipient: params.walletAddress,
    tokenId: 1n,
    amount: 1n,
    data: "0x",
    dataSuffix: params.dataSuffix,
  });
}
