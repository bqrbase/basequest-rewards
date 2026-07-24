import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { logSupabaseError } from "@/lib/supabase/errors";

/**
 * Server-only Supabase admin client (service role).
 * Bypasses RLS. Never import this module from client components.
 */
let adminClient: SupabaseClient | null = null;
let loggedMissingEnv = false;

function assertServerOnly() {
  if (typeof window !== "undefined") {
    throw new Error(
      "getSupabaseAdminClient() is server-only and must not run in the browser",
    );
  }
}

export function getSupabaseAdminClient(): SupabaseClient | null {
  assertServerOnly();

  if (adminClient) {
    return adminClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    if (!loggedMissingEnv) {
      loggedMissingEnv = true;
      logSupabaseError(
        "getSupabaseAdminClient",
        "missing env",
        new Error(
          "NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY is not set",
        ),
        {
          hasUrl: Boolean(url),
          hasServiceRoleKey: Boolean(serviceRoleKey),
        },
      );
    }
    return null;
  }

  adminClient = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return adminClient;
}

export function isSupabaseAdminConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}
