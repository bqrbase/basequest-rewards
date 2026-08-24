import { inspectMiniAppUrl } from "@/lib/task2earn/mini-app";
import { NextResponse } from "next/server";

/**
 * POST /api/tasks/inspect-mini-app
 * Validates/inspects a Mini App URL. Does not claim the app was opened.
 */
export async function POST(request: Request) {
  try {
    let body: { url?: string } = {};
    try {
      body = (await request.json()) as { url?: string };
    } catch {
      return NextResponse.json(
        { success: false, error: "invalid_json" },
        { status: 400 },
      );
    }

    const result = await inspectMiniAppUrl(body.url ?? "");
    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          error: result.error ?? "invalid_url",
          urlInspected: false,
          openVerified: false,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      urlInspected: result.urlInspected,
      openVerified: false,
      target: result.target,
      notice: "URL inspected only. Opening this Mini App has not been verified.",
    });
  } catch (error) {
    console.error("[api/tasks/inspect-mini-app] POST failed", error);
    return NextResponse.json(
      { success: false, error: "inspect_failed", openVerified: false },
      { status: 500 },
    );
  }
}
