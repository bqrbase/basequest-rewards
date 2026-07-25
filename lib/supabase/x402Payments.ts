import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  extractSupabaseError,
  type SupabaseInsertErrorInfo,
} from "@/lib/supabase/deployedContracts";
import { logSupabaseError } from "@/lib/supabase/errors";

/**
 * Expected Supabase table:
 *
 * create table x402_payments (
 *   id uuid primary key default gen_random_uuid(),
 *   wallet_address text not null,
 *   tx_hash text unique not null,
 *   amount text not null,
 *   network text not null,
 *   created_at timestamptz default now()
 * );
 */

export type X402PaymentRow = {
  id: string;
  wallet_address: string;
  tx_hash: string;
  amount: string;
  network: string;
  created_at: string;
};

export type SaveX402PaymentInput = {
  walletAddress: string;
  txHash: string;
  amount: string;
  network: string;
};

export { extractSupabaseError };
export type { SupabaseInsertErrorInfo };

export async function saveX402Payment(
  input: SaveX402PaymentInput,
): Promise<X402PaymentRow> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    const configError = new Error(
      "Supabase admin client is not configured (SUPABASE_SERVICE_ROLE_KEY)",
    );
    logSupabaseError("saveX402Payment", "admin unavailable", configError, {
      walletAddress: input.walletAddress,
    });
    throw configError;
  }

  const payload = {
    wallet_address: input.walletAddress.toLowerCase(),
    tx_hash: input.txHash.toLowerCase(),
    amount: input.amount,
    network: input.network,
  };

  const { data, error } = await supabase
    .from("x402_payments")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    const info = extractSupabaseError(error);
    logSupabaseError("saveX402Payment", "insert", error, {
      payload,
      code: info.code,
      message: info.message,
      details: info.details,
      hint: info.hint,
    });
    throw error;
  }

  return data as X402PaymentRow;
}
