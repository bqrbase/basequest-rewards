import type { Address } from "viem";
import { base } from "viem/chains";

/** JesseCat ERC-721 on Base Mainnet (OpenSea Drop). */
export const JESSECAT_CONTRACT_ADDRESS =
  "0xa325a2b6dedbdace06916d4f27ea8244328163e5" as const satisfies Address;

/** OpenSea collection / drop slug — source of truth for mint stages. */
export const JESSECAT_OPENSEA_SLUG = "jessecat-720030255" as const;

export const JESSECAT_OPENSEA_URL =
  `https://opensea.io/collection/${JESSECAT_OPENSEA_SLUG}` as const;

export const JESSECAT_CHAIN_ID = base.id;

export function getJesseCatBaseScanTxUrl(txHash: string): string {
  return `https://basescan.org/tx/${txHash}`;
}

export function getJesseCatBaseScanAddressUrl(
  address: string = JESSECAT_CONTRACT_ADDRESS,
): string {
  return `https://basescan.org/address/${address}`;
}
