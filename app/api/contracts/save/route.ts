import { NextResponse } from "next/server";
import {
  extractSupabaseError,
  saveDeployedContract,
} from "@/lib/supabase/deployedContracts";
import {
  verifyBaseSwapTx,
  type VerifyBaseSwapTxResult,
} from "@/lib/swap/verifyBaseSwapTx";
import {
  isValidWalletAddress,
  normalizeWalletAddress,
} from "@/lib/x/config";

type SaveBody = {
  wallet?: string;
  contractAddress?: string;
  txHash?: string;
  chainId?: number;
  templateId?: string;
};

function isAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function isTxHash(value: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(value);
}

const BASE_MAINNET_CHAIN_ID = 8453;
const VERIFY_ATTEMPTS = 5;
const VERIFY_RETRY_MS = 800;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Deploy txs are confirmed client-side first; the server's public RPC can lag.
 * Retry transient rpc / missing-receipt failures before failing the save.
 */
async function verifyDeployTxWithRetry(params: {
  txHash: string;
  walletAddress: string;
}): Promise<VerifyBaseSwapTxResult> {
  let last: VerifyBaseSwapTxResult | null = null;

  for (let attempt = 1; attempt <= VERIFY_ATTEMPTS; attempt++) {
    last = await verifyBaseSwapTx(params);
    if (last.ok) {
      return last;
    }

    const retryable =
      last.error === "rpc_error" || last.error === "receipt_not_found";
    if (!retryable || attempt === VERIFY_ATTEMPTS) {
      return last;
    }

    console.warn("[api/contracts/save] tx verify retry", {
      attempt,
      error: last.error,
      message: last.message,
      txHash: params.txHash,
    });
    await sleep(VERIFY_RETRY_MS * attempt);
  }

  return (
    last ?? {
      ok: false,
      error: "rpc_error",
      message: "Failed to verify deployment transaction on Base.",
    }
  );
}

/**
 * POST /api/contracts/save
 * Persists a deployed contract using the service-role admin client.
 * Requires a verified Base deploy tx from the claimed wallet.
 */
export async function POST(request: Request) {
  try {
    let body: SaveBody = {};
    try {
      body = (await request.json()) as SaveBody;
    } catch {
      return NextResponse.json(
        { success: false, error: "invalid_json" },
        { status: 400 },
      );
    }

    const wallet = body.wallet;
    const contractAddress = body.contractAddress;
    const txHash = body.txHash;
    const chainId = body.chainId;
    const templateId = body.templateId ?? "hello-base";

    if (!wallet || !isValidWalletAddress(wallet)) {
      return NextResponse.json(
        { success: false, error: "valid_wallet_required" },
        { status: 400 },
      );
    }

    if (!contractAddress || !isAddress(contractAddress)) {
      return NextResponse.json(
        { success: false, error: "valid_contract_address_required" },
        { status: 400 },
      );
    }

    if (!txHash || !isTxHash(txHash)) {
      return NextResponse.json(
        { success: false, error: "valid_tx_hash_required" },
        { status: 400 },
      );
    }

    if (typeof chainId !== "number" || !Number.isFinite(chainId)) {
      return NextResponse.json(
        { success: false, error: "valid_chain_id_required" },
        { status: 400 },
      );
    }

    if (chainId !== BASE_MAINNET_CHAIN_ID) {
      return NextResponse.json(
        {
          success: false,
          error: "base_mainnet_required",
          message: "Only Base Mainnet (chainId 8453) is supported.",
          chainId,
        },
        { status: 400 },
      );
    }

    const walletAddress = normalizeWalletAddress(wallet);
    const verification = await verifyDeployTxWithRetry({
      txHash,
      walletAddress,
    });
    if (!verification.ok) {
      console.error("[api/contracts/save] tx verification failed", {
        walletAddress,
        txHash,
        contractAddress,
        error: verification.error,
        message: verification.message,
      });
      return NextResponse.json(
        {
          success: false,
          error: verification.error,
          message: verification.message,
        },
        { status: 400 },
      );
    }

    const row = await saveDeployedContract({
      walletAddress,
      templateId,
      contractAddress,
      txHash,
      chainId,
    });

    return NextResponse.json({
      success: true,
      contract: row,
    });
  } catch (error) {
    const info = extractSupabaseError(error);
    console.error("[api/contracts/save] failed:", {
      code: info.code,
      message: info.message,
      details: info.details,
      hint: info.hint,
      raw: info.raw,
    });

    return NextResponse.json(
      {
        success: false,
        error: info.code || "save_failed",
        message: info.message,
        supabase: {
          code: info.code ?? null,
          message: info.message,
          details: info.details ?? null,
          hint: info.hint ?? null,
        },
      },
      { status: 500 },
    );
  }
}
