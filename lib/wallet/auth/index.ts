/**
 * Wallet ownership verification (personal_sign session).
 * Required before server-side XP awards and privileged writes.
 */

export { buildWalletAuthMessage } from "@/lib/wallet/auth/message";
export {
  WALLET_AUTH_CHALLENGE_COOKIE,
  WALLET_AUTH_PUBLIC_COOKIE,
  WALLET_AUTH_SESSION_COOKIE,
} from "@/lib/wallet/auth/constants";
export {
  clearWalletAuthCookies,
  createChallengeNonce,
  readWalletAuthPublicCookie,
  readWalletAuthSessionCookie,
  setWalletAuthChallengeCookie,
  setWalletAuthSessionCookie,
  type WalletAuthChallenge,
  type WalletAuthPublic,
  type WalletAuthSession,
} from "@/lib/wallet/auth/session";
export {
  requireWalletOwnership,
  verifyWalletOwnershipSignature,
} from "@/lib/wallet/auth/verifyOwnership";
