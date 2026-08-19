import { NextResponse } from "next/server";
import {
  extractSupabaseError,
  saveClaimedNft,
} from "@/lib/supabase/claimedNfts";
import {
  BADGE_CLAIM_SELECTOR,
  getBadgeContractAddress,
} from "@/lib/chain/questContracts";
import { verifyBaseTransactionWithRetry } from "@/lib/chain/verifyBaseTransaction";
import {
  isValidWalletAddress,
  normalizeWalletAddress,
} from "@/lib/x/config";

type SaveBody = {
  wallet?: string;
  contractAddress?: string;
  tokenId?: string;
  txHash?: string;
  chainId?: number;
};

const BASE_MAINNET_CHAIN_ID = 8453;

function isAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function isTxHash(value: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(value);
}

/**
 * POST /api/nfts/claim/save
 * Persists a claimed NFT using the service-role admin client.
 * Base Mainnet (8453) only.
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
    const tokenId = body.tokenId;
    const txHash = body.txHash;
    const chainId =
      typeof body.chainId === "number" && Number.isFinite(body.chainId)
        ? body.chainId
        : BASE_MAINNET_CHAIN_ID;

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

    if (!tokenId || typeof tokenId !== "string" || tokenId.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "valid_token_id_required" },
        { status: 400 },
      );
    }

    if (!txHash || !isTxHash(txHash)) {
      return NextResponse.json(
        { success: false, error: "valid_tx_hash_required" },
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

    const badgeAddress = getBadgeContractAddress();
    if (!badgeAddress) {
      return NextResponse.json(
        {
          success: false,
          error: "badge_contract_unconfigured",
          message: "Badge contract address is not configured.",
        },
        { status: 503 },
      );
    }

    if (contractAddress.toLowerCase() !== badgeAddress.toLowerCase()) {
      return NextResponse.json(
        {
          success: false,
          error: "contract_mismatch",
          message: "Claim contract address does not match the Badge contract.",
        },
        { status: 400 },
      );
    }

    const walletAddress = normalizeWalletAddress(wallet);
    const verification = await verifyBaseTransactionWithRetry({
      txHash,
      walletAddress,
      expectedTo: badgeAddress,
      expectedFunctionSelector: BADGE_CLAIM_SELECTOR,
    });
    if (!verification.ok) {
      return NextResponse.json(
        {
          success: false,
          error: verification.error,
          message: verification.message,
        },
        { status: 400 },
      );
    }

    const row = await saveClaimedNft({
      walletAddress,
      contractAddress,
      tokenId: tokenId.trim(),
      txHash,
      chainId,
    });

    return NextResponse.json({
      success: true,
      nft: row,
    });
  } catch (error) {
    const info = extractSupabaseError(error);
    console.error("[api/nfts/claim/save] failed:", {
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
