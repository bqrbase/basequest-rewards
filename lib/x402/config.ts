import type { Address } from "viem";
import { base } from "viem/chains";

/** Base Mainnet CAIP-2 network for x402 v2. */
export const X402_NETWORK = "eip155:8453" as const;

/** Price for the premium test endpoint / quest. */
export const X402_PRICE = "$0.01";

/** Working x402-protected endpoint used by the quest. */
export const X402_PREMIUM_TEST_PATH = "/api/premium/test";

/** @deprecated Use X402_PRICE */
export const X402_DEMO_PRICE = X402_PRICE;

/** @deprecated Use X402_PREMIUM_TEST_PATH */
export const X402_DEMO_PATH = X402_PREMIUM_TEST_PATH;

export const X402_CHAIN_ID = base.id;

export function getX402PayToAddress(): Address | null {
  const raw =
    process.env.X402_PAY_TO?.trim() || process.env.EVM_ADDRESS?.trim();
  if (!raw || !/^0x[a-fA-F0-9]{40}$/.test(raw)) {
    return null;
  }
  return raw as Address;
}
