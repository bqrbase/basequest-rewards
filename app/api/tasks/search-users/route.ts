import { searchFarcasterUsers } from "@/lib/farcaster/neynar";
import { NextResponse } from "next/server";

/**
 * GET /api/tasks/search-users?q=
 * Username search for Follow Only targets. Does not accept or return proof of FID.
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
        username: user.username,
        displayName: user.displayName,
        pfpUrl: user.pfpUrl,
      })),
    });
  } catch (error) {
    console.error("[api/tasks/search-users] GET failed", error);
    return NextResponse.json({ success: true, users: [] });
  }
}
