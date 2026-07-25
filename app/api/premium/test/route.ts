import { createFacilitatorConfig } from "@coinbase/x402";
import {
  HTTPFacilitatorClient,
  x402ResourceServer,
} from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { withX402 } from "@x402/next";
import { NextRequest, NextResponse } from "next/server";
import type { Address } from "viem";

/**
 * GET /api/premium/test
 *
 * Official x402 v2 protection via @x402/next + Coinbase CDP facilitator.
 * Avoids empty `{}` bodies when a PAYMENT-SIGNATURE is present after settle failure.
 */

const NETWORK = "eip155:8453" as const;
const PRICE = "$0.01";

const payTo = process.env.X402_PAY_TO?.trim() as Address | undefined;
const hasPayTo = Boolean(payTo && /^0x[a-fA-F0-9]{40}$/.test(payTo));

type FacilitatorDebug = {
  verify?: unknown;
  settle?: unknown;
  verifyError?: string;
  settleError?: string;
};

/** Per-request facilitator results captured during verify/settle (for empty-body recovery). */
let facilitatorDebug: FacilitatorDebug = {};

function createFacilitatorClient(): HTTPFacilitatorClient {
  const client = new HTTPFacilitatorClient(
    createFacilitatorConfig(
      process.env.CDP_API_KEY_ID,
      process.env.CDP_API_KEY_SECRET,
    ),
  );

  const originalVerify = client.verify.bind(client);
  const originalSettle = client.settle.bind(client);

  client.verify = (async (...args: Parameters<typeof originalVerify>) => {
    try {
      const result = await originalVerify(...args);
      facilitatorDebug.verify = result;
      return result;
    } catch (error) {
      facilitatorDebug.verifyError =
        error instanceof Error ? error.message : String(error);
      throw error;
    }
  }) as typeof client.verify;

  client.settle = (async (...args: Parameters<typeof originalSettle>) => {
    try {
      const result = await originalSettle(...args);
      facilitatorDebug.settle = result;
      return result;
    } catch (error) {
      facilitatorDebug.settleError =
        error instanceof Error ? error.message : String(error);
      throw error;
    }
  }) as typeof client.settle;

  return client;
}

const facilitatorClient = createFacilitatorClient();

const server = new x402ResourceServer(facilitatorClient).register(
  NETWORK,
  new ExactEvmScheme(),
);

async function handler(_request: NextRequest) {
  return NextResponse.json({ success: true }, { status: 200 });
}

const protectedGet = hasPayTo
  ? withX402(
      handler,
      {
        accepts: {
          scheme: "exact",
          price: PRICE,
          network: NETWORK,
          payTo: payTo as Address,
        },
        description: "Premium test endpoint",
        mimeType: "application/json",
      },
      server,
    )
  : null;

function getPaymentSignature(request: NextRequest): string | null {
  return (
    request.headers.get("payment-signature") ||
    request.headers.get("PAYMENT-SIGNATURE") ||
    request.headers.get("x-payment")
  );
}

function isEmptyJsonObject(bodyText: string, parsed: unknown): boolean {
  if (!bodyText || bodyText.trim() === "" || bodyText.trim() === "{}") {
    return true;
  }
  return (
    typeof parsed === "object" &&
    parsed !== null &&
    !Array.isArray(parsed) &&
    Object.keys(parsed as Record<string, unknown>).length === 0
  );
}

export async function GET(request: NextRequest) {
  if (!protectedGet) {
    return NextResponse.json(
      {
        success: false,
        error: "Missing X402_PAY_TO",
      },
      { status: 503 },
    );
  }

  facilitatorDebug = {};

  const paymentSignature = getPaymentSignature(request);

  try {
    const response = await protectedGet(request);
    const statusCode = response.status;
    const bodyText = await response.clone().text();

    let parsedBody: unknown = null;
    try {
      parsedBody = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      parsedBody = bodyText;
    }

    // Unpaid 402 with empty body is normal x402 v2. After signing, never return {}.
    if (paymentSignature && isEmptyJsonObject(bodyText, parsedBody)) {
      console.error("[premium/test] empty response after PAYMENT-SIGNATURE", {
        httpStatusCode: statusCode,
        facilitatorVerifyError: facilitatorDebug.verifyError ?? null,
        facilitatorSettleError: facilitatorDebug.settleError ?? null,
      });
      return NextResponse.json(
        {
          success: false,
          error: "x402_empty_response",
          message:
            "x402 middleware returned an empty JSON body after PAYMENT-SIGNATURE was sent. See facilitator verify/settle fields.",
          httpStatusCode: statusCode,
          paymentSignaturePresent: true,
          facilitatorVerify: facilitatorDebug.verify ?? null,
          facilitatorVerifyError: facilitatorDebug.verifyError ?? null,
          facilitatorSettle: facilitatorDebug.settle ?? null,
          facilitatorSettleError: facilitatorDebug.settleError ?? null,
        },
        { status: statusCode === 200 ? 502 : statusCode || 402 },
      );
    }

    return response;
  } catch (error) {
    console.error("[premium/test] exception:", error);
    return NextResponse.json(
      {
        success: false,
        error: "x402_exception",
        message: error instanceof Error ? error.message : String(error),
        paymentSignaturePresent: Boolean(paymentSignature),
        facilitatorVerify: facilitatorDebug.verify ?? null,
        facilitatorVerifyError: facilitatorDebug.verifyError ?? null,
        facilitatorSettle: facilitatorDebug.settle ?? null,
        facilitatorSettleError: facilitatorDebug.settleError ?? null,
      },
      { status: 500 },
    );
  }
}
