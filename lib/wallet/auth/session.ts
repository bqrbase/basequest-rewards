import { cookies } from "next/headers";
import {
  createWalletAuthNonce,
  getWalletAuthSecret,
  signWalletAuthPayload,
  verifyWalletAuthPayload,
} from "@/lib/wallet/auth/secret";
import { normalizeWalletAddress } from "@/lib/x/config";

export const WALLET_AUTH_SESSION_COOKIE = "bq_wallet_session";
export const WALLET_AUTH_PUBLIC_COOKIE = "bq_wallet_auth_public";
export const WALLET_AUTH_CHALLENGE_COOKIE = "bq_wallet_challenge";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24; // 24 hours
const CHALLENGE_MAX_AGE_SECONDS = 60 * 10; // 10 minutes

export type WalletAuthSession = {
  walletAddress: string;
  expiresAt: number;
};

export type WalletAuthPublic = {
  connected: true;
  walletAddress: string;
  expiresAt: number;
};

export type WalletAuthChallenge = {
  walletAddress: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
  message: string;
};

function encodeSigned(value: unknown, secret: string): string {
  const payload = Buffer.from(JSON.stringify(value), "utf8").toString(
    "base64url",
  );
  const signature = signWalletAuthPayload(payload, secret);
  return `${payload}.${signature}`;
}

function decodeSigned<T>(raw: string | undefined, secret: string): T | null {
  if (!raw) {
    return null;
  }

  const [payload, signature] = raw.split(".");
  if (!payload || !signature) {
    return null;
  }

  if (!verifyWalletAuthPayload(payload, signature, secret)) {
    return null;
  }

  try {
    return JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as T;
  } catch {
    return null;
  }
}

function cookieOptions(maxAge: number, httpOnly: boolean) {
  return {
    httpOnly,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function setWalletAuthChallengeCookie(
  challenge: WalletAuthChallenge,
) {
  const secret = getWalletAuthSecret();
  const store = await cookies();
  store.set(
    WALLET_AUTH_CHALLENGE_COOKIE,
    encodeSigned(challenge, secret),
    cookieOptions(CHALLENGE_MAX_AGE_SECONDS, true),
  );
}

export async function readWalletAuthChallengeCookie(): Promise<WalletAuthChallenge | null> {
  const secret = getWalletAuthSecret();
  const store = await cookies();
  return decodeSigned<WalletAuthChallenge>(
    store.get(WALLET_AUTH_CHALLENGE_COOKIE)?.value,
    secret,
  );
}

export async function clearWalletAuthChallengeCookie() {
  const store = await cookies();
  store.delete(WALLET_AUTH_CHALLENGE_COOKIE);
}

export async function setWalletAuthSessionCookie(session: WalletAuthSession) {
  const secret = getWalletAuthSecret();
  const store = await cookies();
  const walletAddress = normalizeWalletAddress(session.walletAddress);

  store.set(
    WALLET_AUTH_SESSION_COOKIE,
    encodeSigned(
      { walletAddress, expiresAt: session.expiresAt } satisfies WalletAuthSession,
      secret,
    ),
    cookieOptions(SESSION_MAX_AGE_SECONDS, true),
  );

  const publicProfile: WalletAuthPublic = {
    connected: true,
    walletAddress,
    expiresAt: session.expiresAt,
  };

  store.set(
    WALLET_AUTH_PUBLIC_COOKIE,
    encodeSigned(publicProfile, secret),
    cookieOptions(SESSION_MAX_AGE_SECONDS, false),
  );
}

export async function readWalletAuthSessionCookie(): Promise<WalletAuthSession | null> {
  const secret = getWalletAuthSecret();
  const store = await cookies();
  const session = decodeSigned<WalletAuthSession>(
    store.get(WALLET_AUTH_SESSION_COOKIE)?.value,
    secret,
  );

  if (!session) {
    return null;
  }

  if (session.expiresAt < Date.now()) {
    return null;
  }

  return {
    walletAddress: normalizeWalletAddress(session.walletAddress),
    expiresAt: session.expiresAt,
  };
}

export async function readWalletAuthPublicCookie(): Promise<WalletAuthPublic | null> {
  const secret = getWalletAuthSecret();
  const store = await cookies();
  const profile = decodeSigned<WalletAuthPublic>(
    store.get(WALLET_AUTH_PUBLIC_COOKIE)?.value,
    secret,
  );

  if (!profile || profile.expiresAt < Date.now()) {
    return null;
  }

  return profile;
}

export async function clearWalletAuthCookies() {
  const store = await cookies();
  store.delete(WALLET_AUTH_SESSION_COOKIE);
  store.delete(WALLET_AUTH_PUBLIC_COOKIE);
  store.delete(WALLET_AUTH_CHALLENGE_COOKIE);
}

export function createChallengeNonce(): string {
  return createWalletAuthNonce();
}
