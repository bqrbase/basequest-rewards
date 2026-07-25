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
 * Debug wrapper logs the post-signature path and avoids empty `{}` bodies
 * when a PAYMENT-SIGNATURE is present.
 */

const NETWORK = "eip155:8453" as const;
const PRICE = "$0.01";
const LOG = "[premium/test]";

const payTo = process.env.X402_PAY_TO?.trim() as Address | undefined;
const hasPayTo = Boolean(payTo && /^0x[a-fA-F0-9]{40}$/.test(payTo));

type FacilitatorDebug = {
  verify?: unknown;
  settle?: unknown;
  verifyError?: string;
  settleError?: string;
};

/** Per-request facilitator debug captured during verify/settle. */
let facilitatorDebug: FacilitatorDebug = {};

function createLoggingFacilitatorClient(): HTTPFacilitatorClient {
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
      console.error(`${LOG} facilitator verify response:`, result);
      return result;
    } catch (error) {
      facilitatorDebug.verifyError =
        error instanceof Error ? error.message : String(error);
      console.error(`${LOG} facilitator verify exception:`, error);
      throw error;
    }
  }) as typeof client.verify;

  client.settle = (async (...args: Parameters<typeof originalSettle>) => {
    try {
      const result = await originalSettle(...args);
      facilitatorDebug.settle = result;
      console.error(`${LOG} facilitator settle response:`, result);
      return result;
    } catch (error) {
      facilitatorDebug.settleError =
        error instanceof Error ? error.message : String(error);
      console.error(`${LOG} facilitator settle exception:`, error);
      throw error;
    }
  }) as typeof client.settle;

  return client;
}

const facilitatorClient = createLoggingFacilitatorClient();

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

function headersToObject(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    // Avoid dumping full payment payloads into logs when huge; keep presence + length.
    if (
      key.toLowerCase() === "payment-signature" ||
      key.toLowerCase() === "x-payment" ||
      key.toLowerCase() === "payment-response" ||
      key.toLowerCase() === "payment-required"
    ) {
      out[key] = `[present length=${value.length}]`;
      return;
    }
    out[key] = value;
  });
  return out;
}

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
  const requestHeaders = headersToObject(request.headers);

  console.error(`${LOG} incoming request after wallet signature path:`, {
    method: request.method,
    url: request.url,
    paymentSignaturePresent: Boolean(paymentSignature),
    paymentSignatureLength: paymentSignature?.length ?? 0,
    requestHeaders,
  });

  try {
    const response = await protectedGet(request);
    const statusCode = response.status;
    const responseHeaders = headersToObject(response.headers);
    const bodyText = await response.clone().text();

    let parsedBody: unknown = null;
    try {
      parsedBody = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      parsedBody = bodyText;
    }

    console.error(`${LOG} final response:`, {
      httpStatusCode: statusCode,
      paymentSignaturePresent: Boolean(paymentSignature),
      responseHeaders,
      facilitatorVerify: facilitatorDebug.verify ?? null,
      facilitatorVerifyError: facilitatorDebug.verifyError ?? null,
      facilitatorSettle: facilitatorDebug.settle ?? null,
      facilitatorSettleError: facilitatorDebug.settleError ?? null,
      finalResponseBody: parsedBody,
      finalResponseBodyRaw: bodyText,
    });

    // Unpaid 402 with empty body is normal x402 v2. After signing, never return {}.
    if (paymentSignature && isEmptyJsonObject(bodyText, parsedBody)) {
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
    console.error(`${LOG} caught exception:`, error);
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
