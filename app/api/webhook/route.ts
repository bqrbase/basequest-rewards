import { NextResponse } from "next/server";

/**
 * GET /api/webhook
 * Lightweight health check for webhook availability (Base / Farcaster clients).
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "BaseQuest Rewards Webhook",
  });
}

/**
 * POST /api/webhook
 * Receives webhook payloads (e.g. Mini App / Farcaster notifications).
 *
 * Future Farcaster event handling can be implemented below after JSON parse:
 * - miniapp_added / miniapp_removed
 * - notifications_enabled / notifications_disabled
 * - cast / mention / reaction events (if subscribed)
 * Keep this handler resilient: never throw on malformed or unexpected payloads.
 */
export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid JSON",
      },
      { status: 400 },
    );
  }

  // Log inbound payload for observability. Replace with structured handling later.
  console.log("[api/webhook] received payload:", payload);

  // TODO(farcaster): branch on payload type / event name and process Mini App events.
  // Example shape (illustrative only — do not assume this schema yet):
  // if (payload && typeof payload === "object" && "type" in payload) { ... }

  return NextResponse.json({ success: true });
}
