import { searchFarcasterUsers } from "@/lib/farcaster/neynar";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function publicSearchError(error: unknown): string {
  if (!(error instanceof Error) || !error.message.trim()) {
    return "Unable to search Farcaster users";
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
 * GET /api/tasks/search-users?q=
 * Username/display-name search for Follow Only targets.
 * Returns Neynar-resolved profile fields including FID for UI selection.
 * FID in this response is not accepted as proof on create.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ success: true, users: [] });
  }

  try {
    const users = await searchFarcasterUsers(q, 8);
    return NextResponse.json({
      success: true,
      users: users.map((user) => ({
        fid: user.fid,
        username: user.username,
        displayName: user.displayName,
        pfpUrl: user.pfpUrl,
      })),
    });
  } catch (error) {
    console.error("[api/tasks/search-users] GET failed", error);
    return NextResponse.json(
      {
        success: false,
        users: [],
        error: publicSearchError(error),
      },
      { status: 502 },
    );
  }
}
