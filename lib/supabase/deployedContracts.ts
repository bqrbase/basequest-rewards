import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSupabaseError } from "@/lib/supabase/errors";

/**
 * Expected Supabase table:
 *
 * create table deployed_contracts (
 *   id uuid primary key default gen_random_uuid(),
 *   wallet_address text not null,
 *   template_id text not null,
 *   contract_address text not null,
 *   tx_hash text,
 *   chain_id integer not null,
 *   created_at timestamptz not null default now()
 * );
 *
 * Inserts must use the service-role admin client (see lib/supabase/admin.ts)
 * so RLS does not block server-side writes.
 */

export type DeployedContractRow = {
  id: string;
  wallet_address: string;
  template_id: string;
  contract_address: string;
  tx_hash: string | null;
  chain_id: number;
  created_at: string;
};

export type SaveDeployedContractInput = {
  walletAddress: string;
  templateId: string;
  contractAddress: string;
  txHash?: string | null;
  chainId: number;
};

/** Normalized Supabase/PostgREST error fields for debugging. */
export type SupabaseInsertErrorInfo = {
  code?: string;
  message: string;
  details?: string;
  hint?: string;
  raw: unknown;
};

function normalizeWalletAddress(walletAddress: string) {
  return walletAddress.toLowerCase();
}

export function extractSupabaseError(error: unknown): SupabaseInsertErrorInfo {
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const message =
      typeof record.message === "string" && record.message.length > 0
        ? record.message
        : error instanceof Error
          ? error.message
          : JSON.stringify(error);

    return {
      code: typeof record.code === "string" ? record.code : undefined,
      message,
      details: typeof record.details === "string" ? record.details : undefined,
      hint: typeof record.hint === "string" ? record.hint : undefined,
      raw: error,
    };
  }

  return {
    message: error instanceof Error ? error.message : String(error),
    raw: error,
  };
}

/**
 * Insert a deployed contract row using the service-role admin client.
 * If the contract_address (or tx_hash) already exists, return the existing row.
 * Server-only — never call from the browser.
 */
export async function saveDeployedContract(
  input: SaveDeployedContractInput,
): Promise<DeployedContractRow> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    const configError = new Error(
      "Supabase admin client is not configured (SUPABASE_SERVICE_ROLE_KEY)",
    );
    logSupabaseError("saveDeployedContract", "admin unavailable", configError, {
      walletAddress: input.walletAddress,
    });
    throw configError;
  }

  const contractAddress = input.contractAddress.toLowerCase();
  const payload = {
    wallet_address: normalizeWalletAddress(input.walletAddress),
    template_id: input.templateId,
    contract_address: contractAddress,
    tx_hash: input.txHash ?? null,
    chain_id: input.chainId,
  };

  // Idempotent: treat an already-persisted contract as success.
  const existingByAddress = await supabase
    .from("deployed_contracts")
    .select("*")
    .eq("contract_address", contractAddress)
    .maybeSingle();

  if (existingByAddress.error) {
    const info = extractSupabaseError(existingByAddress.error);
    logSupabaseError("saveDeployedContract", "select existing", existingByAddress.error, {
      contractAddress,
      code: info.code,
      message: info.message,
    });
  } else if (existingByAddress.data) {
    return existingByAddress.data as DeployedContractRow;
  }

  if (payload.tx_hash) {
    const existingByTx = await supabase
      .from("deployed_contracts")
      .select("*")
      .eq("tx_hash", payload.tx_hash)
      .maybeSingle();

    if (!existingByTx.error && existingByTx.data) {
      return existingByTx.data as DeployedContractRow;
    }
  }

  const { data, error } = await supabase
    .from("deployed_contracts")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    const info = extractSupabaseError(error);

    // Unique violation / race: another writer inserted first — return existing.
    if (info.code === "23505") {
      const raced = await supabase
        .from("deployed_contracts")
        .select("*")
        .eq("contract_address", contractAddress)
        .maybeSingle();
      if (raced.data) {
        return raced.data as DeployedContractRow;
      }
    }

    logSupabaseError("saveDeployedContract", "insert", error, {
      payload,
      code: info.code,
      message: info.message,
      details: info.details,
      hint: info.hint,
    });
    throw error;
  }

  return data as DeployedContractRow;
}
