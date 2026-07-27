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
 * Resolve a best-effort event type from common Farcaster / Mini App payload shapes.
 */
function resolveEventType(body: Record<string, unknown>): string | undefined {
  const candidates = [body.type, body.event, body.eventType];
  for (const value of candidates) {
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return undefined;
}

/**
 * POST /api/webhook
 * Receives webhook payloads (e.g. Mini App / Farcaster notifications).
 *
 * Keep this handler resilient and dependency-free:
 * - never throw on malformed or unexpected payloads
 * - acknowledge receipt quickly; heavy work belongs in follow-up jobs
 *
 * TODO(security): Implement Farcaster signature verification here (before handling),
 * using the request headers + raw body against the Mini App webhook signing secret.
 *
 * TODO(supabase): After verification, upsert users / sessions / event rows in Supabase.
 *
 * TODO(rewards): On quest / engagement events, grant XP and update streaks / rewards.
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

  const timestamp = new Date().toISOString();
  const headers = Object.fromEntries(request.headers.entries());

  console.log("[api/webhook] timestamp:", timestamp);
  console.log("[api/webhook] headers:", headers);
  console.log("[api/webhook] payload:", payload);

  const body =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {};
  const eventType = resolveEventType(body);

  // Future Farcaster / Mini App event handling (lightweight stubs only).
  switch (eventType) {
    case "miniapp.open":
      // TODO(analytics): record Mini App open / session start.
      // TODO(supabase): upsert user session or last_seen_at.
      break;
    case "user.connected":
      // TODO(supabase): sync connected Farcaster / wallet identity.
      break;
    case "quest.completed":
      // TODO(rewards): grant XP / update quest completion state.
      // TODO(supabase): persist quest completion and XP delta.
      break;
    default:
      console.log("Unhandled webhook event:", eventType);
      break;
  }

  return NextResponse.json({
    success: true,
    received: true,
  });
}
