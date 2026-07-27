/**
 * Admin auth for rewards ops APIs.
 * Uses REWARDS_ADMIN_SECRET — never a chain private key.
 */

function getAdminSecret(): string | null {
  const value = process.env.REWARDS_ADMIN_SECRET?.trim();
  return value && value.length >= 16 ? value : null;
}

export function isRewardsAdminConfigured(): boolean {
  return getAdminSecret() !== null;
}

/**
 * Validate `Authorization: Bearer <secret>` or `x-rewards-admin-secret`.
 */
export function assertRewardsAdmin(request: Request): void {
  const expected = getAdminSecret();
  if (!expected) {
    throw new RewardsAdminAuthError(
      "REWARDS_ADMIN_SECRET is not configured (min 16 chars)",
      503,
    );
  }

  const headerSecret = request.headers.get("x-rewards-admin-secret")?.trim();
  const auth = request.headers.get("authorization");
  const bearer =
    auth && auth.toLowerCase().startsWith("bearer ")
      ? auth.slice(7).trim()
      : null;
  const provided = headerSecret || bearer;

  if (!provided || !timingSafeEqualString(provided, expected)) {
    throw new RewardsAdminAuthError("Unauthorized", 401);
  }
}

export class RewardsAdminAuthError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "RewardsAdminAuthError";
    this.status = status;
  }
}

function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let out = 0;
  for (let i = 0; i < a.length; i += 1) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}
