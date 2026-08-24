import { searchMiniApps } from "@/lib/task2earn/mini-app";
import { NextResponse } from "next/server";

/**
 * GET /api/tasks/search-mini-apps?q=
 * Best-effort name/URL search. Empty results are expected.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ success: true, apps: [] });
  }

  try {
    const apps = await searchMiniApps(q);
    return NextResponse.json({ success: true, apps });
  } catch (error) {
    console.error("[api/tasks/search-mini-apps] GET failed", error);
    return NextResponse.json({ success: true, apps: [] });
  }
}
