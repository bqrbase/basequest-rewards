import { normalizeWalletAddress } from "@/lib/x/config";

export const WALLET_AUTH_DOMAIN = "BaseQuest Rewards";
export const WALLET_AUTH_STATEMENT =
  "Sign this message to prove you control this wallet. This does not trigger a blockchain transaction or cost gas.";

/**
 * Deterministic personal_sign message for wallet ownership.
 */
export function buildWalletAuthMessage(params: {
  walletAddress: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
}): string {
  const address = normalizeWalletAddress(params.walletAddress);

  return [
    `${WALLET_AUTH_DOMAIN} — Wallet ownership verification`,
    "",
    WALLET_AUTH_STATEMENT,
    "",
    `Wallet: ${address}`,
    `Nonce: ${params.nonce}`,
    `Issued At: ${params.issuedAt}`,
    `Expires At: ${params.expiresAt}`,
  ].join("\n");
}
