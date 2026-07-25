import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  extractSupabaseError,
  type SupabaseInsertErrorInfo,
} from "@/lib/supabase/deployedContracts";
import { logSupabaseError } from "@/lib/supabase/errors";

/**
 * Expected Supabase table:
 *
 * create table claimed_nfts (
 *   id uuid primary key default gen_random_uuid(),
 *   wallet_address text not null,
 *   contract_address text not null,
 *   token_id bigint not null,
 *   tx_hash text unique,
 *   chain_id integer not null,
 *   created_at timestamptz default now()
 * );
 *
 * Inserts must use the service-role admin client.
 */

export type ClaimedNftRow = {
  id: string;
  wallet_address: string;
  contract_address: string;
  token_id: string;
  tx_hash: string;
  chain_id: number;
  created_at: string;
};

export type SaveClaimedNftInput = {
  walletAddress: string;
  contractAddress: string;
  tokenId: string;
  txHash: string;
  chainId: number;
};

function normalizeWalletAddress(walletAddress: string) {
  return walletAddress.toLowerCase();
}

export { extractSupabaseError };
export type { SupabaseInsertErrorInfo };

/**
 * Insert a claimed NFT row using the service-role admin client.
 * Server-only — never call from the browser.
 */
export async function saveClaimedNft(
  input: SaveClaimedNftInput,
): Promise<ClaimedNftRow> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    const configError = new Error(
      "Supabase admin client is not configured (SUPABASE_SERVICE_ROLE_KEY)",
    );
    logSupabaseError("saveClaimedNft", "admin unavailable", configError, {
      walletAddress: input.walletAddress,
    });
    throw configError;
  }

  const payload = {
    wallet_address: normalizeWalletAddress(input.walletAddress),
    contract_address: input.contractAddress.toLowerCase(),
    token_id: input.tokenId,
    tx_hash: input.txHash.toLowerCase(),
    chain_id: input.chainId,
  };

  const { data, error } = await supabase
    .from("claimed_nfts")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    const info = extractSupabaseError(error);
    logSupabaseError("saveClaimedNft", "insert", error, {
      payload,
      code: info.code,
      message: info.message,
      details: info.details,
      hint: info.hint,
    });
    throw error;
  }

  return data as ClaimedNftRow;
}
