import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Temporary debug endpoint.
 * GET /api/debug/users-columns
 *
 * Uses the same service-role client as saveXFollowVerification().
 * Probes whether PostgREST exposes twitter_user_id / x_follow_verified_at.
 *
 * Note: @supabase/supabase-js service role talks to PostgREST, not direct Postgres.
 * The select below is the REST equivalent of:
 *   select wallet_address, twitter_user_id, x_follow_verified_at
 *   from public.users
 *   limit 1;
 */
export async function GET() {
  const supabase = getSupabaseAdminClient();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
  const sql =
    "select wallet_address,twitter_user_id,x_follow_verified_at from public.users limit 1";
  const requestPath = "/rest/v1/users";

  if (!supabase) {
    return NextResponse.json(
      {
        error: "service_role_not_configured",
        message:
          "SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL missing. Same client as saveXFollowVerification().",
        supabaseUrl,
      },
      { status: 500 },
    );
  }

  const { data, error } = await supabase
    .from("users")
    .select("wallet_address,twitter_user_id,x_follow_verified_at")
    .limit(1);

  const selectSucceeded = !error;
  const selectIsPgrst204 = error?.code === "PGRST204";

  // Probe update path with only the two columns (filter matches no real wallet).
  const { data: updateData, error: updateError } = await supabase
    .from("users")
    .update({
      twitter_user_id: "pgrst204-probe",
      x_follow_verified_at: new Date().toISOString(),
    })
    .eq("wallet_address", "0x0000000000000000000000000000000000000000")
    .select("wallet_address,twitter_user_id,x_follow_verified_at");

  const updateSucceeded = !updateError;
  const updateIsPgrst204 = updateError?.code === "PGRST204";

  let diagnosis: string;
  if (selectIsPgrst204 || updateIsPgrst204) {
    diagnosis =
      "PostgREST schema cache issue: columns exist in Postgres but are not visible to PostgREST (PGRST204). Reload the API schema cache in Supabase (Settings → API → Reload schema, or wait for cache refresh).";
  } else if (selectSucceeded && updateSucceeded) {
    diagnosis =
      "Service-role REST select/update of twitter_user_id + x_follow_verified_at succeeded. If saveXFollowVerification() still returns PGRST204, another column in that update payload is missing from the PostgREST schema cache (e.g. x_username).";
  } else {
    diagnosis =
      "Unexpected Supabase error (not PGRST204). See selectError / updateError.";
  }

  return NextResponse.json({
    supabaseUrl,
    requestPath,
    client: "service_role",
    sql,
    note: "Executed via PostgREST .select()/.update() (service-role JS cannot run raw SQL).",
    select: {
      ok: selectSucceeded,
      data,
      error,
    },
    updateProbe: {
      ok: updateSucceeded,
      filter: {
        wallet_address: "0x0000000000000000000000000000000000000000",
      },
      data: updateData,
      error: updateError,
    },
    diagnosis,
  });
}
