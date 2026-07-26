import { createHash, randomBytes } from "crypto";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

/**
 * Generate a short unique-looking referral code.
 * Collision retries happen at the DB unique constraint layer.
 */
export function generateReferralCode(seed?: string): string {
  if (seed) {
    const digest = createHash("sha256").update(seed.toLowerCase()).digest();
    let code = "";
    for (let i = 0; i < CODE_LENGTH; i += 1) {
      code += CODE_ALPHABET[digest[i] % CODE_ALPHABET.length];
    }
    return code;
  }

  const bytes = randomBytes(CODE_LENGTH);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return code;
}

export function normalizeReferralCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isValidReferralCode(code: string): boolean {
  const normalized = normalizeReferralCode(code);
  return normalized.length >= 6 && normalized.length <= 12;
}
