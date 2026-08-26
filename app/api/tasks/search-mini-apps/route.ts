import { searchMiniApps } from "@/lib/task2earn/mini-app";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function publicSearchError(error: unknown): string {
  if (!(error instanceof Error) || !error.message.trim()) {
    return "Unable to search Farcaster Mini Apps";
  }
  if (error.message.includes("NEYNAR_API_KEY")) {
    return "Neynar is not configured on the server (NEYNAR_API_KEY)";
  }
  return error.message.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    "[redacted]",
  );
}

/**
 * GET /api/tasks/search-mini-apps?q=
 * Name/URL search for Mini App targets.
 * Empty `apps` is only returned for a valid search with no matches.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ success: true, apps: [] });
  }

  try {
    const apps = await searchMiniApps(q);
    return NextResponse.json({
      success: true,
      apps: apps.map((app) => ({
        kind: "mini_app" as const,
        name: app.name,
        url: app.url,
        appId: app.appId,
        metadata: app.metadata,
      })),
    });
  } catch (error) {
    console.error("[api/tasks/search-mini-apps] GET failed", error);
    return NextResponse.json(
      {
        success: false,
        apps: [],
        error: publicSearchError(error),
      },
      { status: 502 },
    );
  }
}
