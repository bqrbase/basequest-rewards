import { NextResponse } from "next/server";
import {
  extractSupabaseError,
  saveDeployedContract,
} from "@/lib/supabase/deployedContracts";
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

/**
 * POST /api/contracts/save
 * Persists a deployed contract address using the service-role admin client.
 * Bypasses RLS — never uses the browser anon client.
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

    if (txHash && !isTxHash(txHash)) {
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

    const walletAddress = normalizeWalletAddress(wallet);
    const payload = {
      wallet_address: walletAddress,
      template_id: templateId,
      contract_address: contractAddress.toLowerCase(),
      tx_hash: txHash ?? null,
      chain_id: chainId,
    };

    console.error("[api/contracts/save] insert payload:", payload);

    const row = await saveDeployedContract({
      walletAddress,
      templateId,
      contractAddress,
      txHash: txHash ?? null,
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
        error: info.message,
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
