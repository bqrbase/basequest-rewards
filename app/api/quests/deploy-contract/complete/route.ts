import { NextResponse } from "next/server";
import {
  completeOneTimeQuest,
  QUEST_DEFINITIONS,
  type QuestProgress,
} from "@/lib/quest-engine";
import {
  extractSupabaseError,
  saveDeployedContract,
} from "@/lib/supabase/deployedContracts";
import {
  fetchOrCreateUser,
  saveUserProgress,
  userRowToProgress,
} from "@/lib/supabase/users";
import {
  isValidWalletAddress,
  normalizeWalletAddress,
} from "@/lib/x/config";

type CompleteBody = {
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
 * POST /api/quests/deploy-contract/complete
 * Saves the deployed contract address and completes the deploy-contract quest.
 */
export async function POST(request: Request) {
  try {
    let body: CompleteBody = {};
    try {
      body = (await request.json()) as CompleteBody;
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
    const insertPayload = {
      wallet_address: walletAddress,
      template_id: templateId,
      contract_address: contractAddress.toLowerCase(),
      tx_hash: txHash ?? null,
      chain_id: chainId,
    };

    console.error(
      "[deploy-contract/complete] about to insert payload:",
      insertPayload,
    );

    try {
      await saveDeployedContract({
        walletAddress,
        templateId,
        contractAddress,
        txHash: txHash ?? null,
        chainId,
      });
    } catch (saveError) {
      const info = extractSupabaseError(saveError);
      console.error("[deploy-contract/complete] saveDeployedContract failed:", {
        code: info.code,
        message: info.message,
        details: info.details,
        hint: info.hint,
        payload: insertPayload,
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
          payload: insertPayload,
        },
        { status: 500 },
      );
    }

    const user = await fetchOrCreateUser(walletAddress);
    let progress: QuestProgress = user
      ? userRowToProgress(user)
      : {
          totalXp: 0,
          streak: 0,
          lastCheckInDate: null,
          completedQuestIds: [],
        };

    const alreadyCompleted =
      progress.completedQuestIds.includes("deploy-contract");

    if (!alreadyCompleted) {
      progress = completeOneTimeQuest(
        progress,
        "deploy-contract",
        QUEST_DEFINITIONS,
      );

      try {
        await saveUserProgress(walletAddress, progress);
      } catch (progressError) {
        console.error(
          "[deploy-contract/complete] saveUserProgress",
          progressError,
        );
      }
    }

    return NextResponse.json({
      success: true,
      alreadyCompleted,
      contractAddress: contractAddress.toLowerCase(),
      progress: {
        totalXp: progress.totalXp,
        streak: progress.streak,
        lastCheckInDate: progress.lastCheckInDate,
        completedQuestIds: progress.completedQuestIds,
      },
    });
  } catch (error) {
    const info = extractSupabaseError(error);
    console.error("[deploy-contract/complete]", {
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
