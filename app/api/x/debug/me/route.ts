import { NextResponse } from "next/server";
import { readXSessionCookie } from "@/lib/x/session";

/**
 * Temporary debug endpoint.
 * GET /api/x/debug/me
 *
 * Calls X API with OAuth session access token only (no X_BEARER_TOKEN).
 */
export async function GET() {
  const session = await readXSessionCookie();

  if (!session?.accessToken) {
    return NextResponse.json(
      {
        error: "not_authenticated",
        message: "No OAuth session access token. Connect X first.",
      },
      { status: 401 },
    );
  }

  const response = await fetch(
    "https://api.x.com/2/users/me?user.fields=username,name",
    {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
      cache: "no-store",
    },
  );

  const responseText = await response.text();
  let body: unknown = null;
  try {
    body = responseText ? JSON.parse(responseText) : null;
  } catch {
    body = { raw: responseText };
  }

  return NextResponse.json({
    status: response.status,
    body,
  });
}
