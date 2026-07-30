import { createHmac, randomBytes, timingSafeEqual } from "crypto";

/**
 * Server secret for wallet ownership sessions.
 * Prefer WALLET_AUTH_SECRET; fall back to existing server secrets.
 */
export function getWalletAuthSecret(): string {
  const value =
    process.env.WALLET_AUTH_SECRET?.trim() ||
    process.env.X_CLIENT_SECRET?.trim() ||
    process.env.REWARDS_ADMIN_SECRET?.trim();

  if (!value || value.length < 16) {
    throw new Error(
      "WALLET_AUTH_SECRET (or X_CLIENT_SECRET / REWARDS_ADMIN_SECRET, min 16 chars) is not configured",
    );
  }

  return value;
}

export function createWalletAuthNonce(): string {
  return randomBytes(24).toString("hex");
}

export function signWalletAuthPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function verifyWalletAuthPayload(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const expected = signWalletAuthPayload(payload, secret);
  const left = Buffer.from(expected);
  const right = Buffer.from(signature);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}
