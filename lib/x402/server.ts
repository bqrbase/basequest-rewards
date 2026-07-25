import { createFacilitatorConfig } from "@coinbase/x402";
import {
  HTTPFacilitatorClient,
  x402ResourceServer,
} from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";

/** Base Mainnet CAIP-2 network. */
const NETWORK = "eip155:8453" as const;

/**
 * Shared x402 resource server using the official Coinbase CDP facilitator.
 * https://api.cdp.coinbase.com/platform/v2/x402
 *
 * Auth: CDP_API_KEY_ID + CDP_API_KEY_SECRET via @coinbase/x402.
 */
function createX402ResourceServer(): x402ResourceServer {
  const facilitatorClient = new HTTPFacilitatorClient(
    createFacilitatorConfig(
      process.env.CDP_API_KEY_ID,
      process.env.CDP_API_KEY_SECRET,
    ),
  );

  return new x402ResourceServer(facilitatorClient).register(
    NETWORK,
    new ExactEvmScheme(),
  );
}

let cachedServer: x402ResourceServer | null = null;

export function getX402ResourceServer(): x402ResourceServer {
  if (!cachedServer) {
    cachedServer = createX402ResourceServer();
  }
  return cachedServer;
}
