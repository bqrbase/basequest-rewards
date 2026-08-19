import { NextResponse } from "next/server";
import {
  extractSupabaseError,
  saveDeployedContract,
} from "@/lib/supabase/deployedContracts";
import { verifyBaseTransactionWithRetry } from "@/lib/chain/verifyBaseTransaction";
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
    const verification = await verifyBaseTransactionWithRetry({
      txHash,
      walletAddress,
      allowContractCreation: true,
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

    const created = verification.receipt.contractAddress?.toLowerCase();
    if (created && created !== contractAddress.toLowerCase()) {
      return NextResponse.json(
        {
          success: false,
          error: "contract_mismatch",
          message: "Deployed contract address does not match this transaction.",
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
