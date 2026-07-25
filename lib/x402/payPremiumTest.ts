import { toClientEvmSigner } from "@x402/evm";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import {
  wrapFetchWithPayment,
  x402Client,
  x402HTTPClient,
} from "@x402/fetch";
import {
  X402_CHAIN_ID,
  X402_NETWORK,
  X402_PREMIUM_TEST_PATH,
  X402_PRICE,
} from "@/lib/x402/config";
import type { Address, Hash } from "viem";
import { base } from "viem/chains";
import type { Config } from "wagmi";
import { getPublicClient, getWalletClient } from "wagmi/actions";

export type PayPremiumTestParams = {
  config: Config;
  walletAddress: Address;
};

export type PayPremiumTestSuccess = {
  ok: true;
  txHash: Hash;
  network: string;
  amount: string;
  endpointUrl: string;
};

export type PayPremiumTestFailure = {
  ok: false;
  message: string;
};

export type PayPremiumTestResult =
  | PayPremiumTestSuccess
  | PayPremiumTestFailure;

function resolveEndpointUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}${X402_PREMIUM_TEST_PATH}`;
  }
  return X402_PREMIUM_TEST_PATH;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    if (/user rejected|denied|rejected the request/i.test(error.message)) {
      return "Payment signature was rejected in your wallet.";
    }
    return error.message;
  }
  return String(error);
}

function extractAmount(settle: {
  amount?: unknown;
  requirements?: { amount?: unknown };
}): string {
  if (typeof settle.amount === "string" && settle.amount.length > 0) {
    return settle.amount;
  }
  if (
    settle.requirements &&
    typeof settle.requirements.amount === "string" &&
    settle.requirements.amount.length > 0
  ) {
    return settle.requirements.amount;
  }
  return X402_PRICE;
}

/**
 * Call GET /api/premium/test with official @x402/fetch payment handling.
 * On 402, the client completes the wallet payment and retries until 200.
 */
export async function payPremiumTest(
  params: PayPremiumTestParams,
): Promise<PayPremiumTestResult> {
  const endpointUrl = resolveEndpointUrl();

  try {
    const walletClient = await getWalletClient(params.config, {
      account: params.walletAddress,
      chainId: X402_CHAIN_ID,
    });

    if (!walletClient?.account) {
      return {
        ok: false,
        message: "Connect your wallet on Base to make an x402 payment.",
      };
    }

    const publicClient = await getPublicClient(params.config, {
      chainId: X402_CHAIN_ID,
    });

    if (!publicClient) {
      return {
        ok: false,
        message: "Base public client is unavailable. Try again.",
      };
    }

    const signer = toClientEvmSigner(
      {
        address: walletClient.account.address,
        signTypedData: async (message) =>
          walletClient.signTypedData({
            account: walletClient.account!,
            domain: message.domain as Record<string, unknown>,
            types: message.types as Record<string, unknown>,
            primaryType: message.primaryType,
            message: message.message,
          }),
      },
      publicClient,
    );

    const client = new x402Client();
    client.register(X402_NETWORK, new ExactEvmScheme(signer));
    client.register("eip155:*", new ExactEvmScheme(signer));

    const fetchWithPayment = wrapFetchWithPayment(fetch, client);
    const response = await fetchWithPayment(endpointUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      return {
        ok: false,
        message:
          bodyText ||
          `Premium test request failed with status ${response.status}.`,
      };
    }

    const httpClient = new x402HTTPClient(client);
    const settle = httpClient.getPaymentSettleResponse((name) =>
      response.headers.get(name),
    );

    const txHash = settle?.transaction;
    if (!txHash || typeof txHash !== "string" || !txHash.startsWith("0x")) {
      return {
        ok: false,
        message:
          "Payment settled but no transaction hash was returned in PAYMENT-RESPONSE.",
      };
    }

    return {
      ok: true,
      txHash: txHash as Hash,
      network:
        typeof settle.network === "string" ? settle.network : X402_NETWORK,
      amount: extractAmount(settle),
      endpointUrl,
    };
  } catch (error) {
    console.error("[payPremiumTest]", error);
    return {
      ok: false,
      message: getErrorMessage(error),
    };
  }
}

export function getBaseScanTxUrl(txHash: string, chainId = base.id): string {
  return `https://basescan.org/tx/${txHash}`;
}
