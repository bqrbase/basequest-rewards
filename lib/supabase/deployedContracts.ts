import { getSupabaseClient } from "@/lib/supabase/client";
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
 * create index if not exists deployed_contracts_wallet_idx
 *   on deployed_contracts (wallet_address);
 *
 * -- App uses the anon key (no Supabase Auth session). If RLS is on, allow inserts:
 * alter table deployed_contracts enable row level security;
 * create policy "Allow anon insert deployed_contracts"
 *   on deployed_contracts for insert to anon with check (true);
 * create policy "Allow anon select deployed_contracts"
 *   on deployed_contracts for select to anon using (true);
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

export async function saveDeployedContract(
  input: SaveDeployedContractInput,
): Promise<DeployedContractRow | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    logSupabaseError(
      "saveDeployedContract",
      "client unavailable",
      new Error("Supabase client is not configured"),
      { walletAddress: input.walletAddress },
    );
    return null;
  }

  const payload = {
    wallet_address: normalizeWalletAddress(input.walletAddress),
    template_id: input.templateId,
    contract_address: input.contractAddress.toLowerCase(),
    tx_hash: input.txHash ?? null,
    chain_id: input.chainId,
  };

  console.error("[saveDeployedContract] insert payload:", payload);

  const { data, error } = await supabase
    .from("deployed_contracts")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    const info = extractSupabaseError(error);
    console.error("[saveDeployedContract] exact Supabase error:", {
      code: info.code,
      message: info.message,
      details: info.details,
      hint: info.hint,
      payload,
      raw: info.raw,
    });
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
