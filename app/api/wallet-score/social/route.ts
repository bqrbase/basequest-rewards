import {
  fetchUsersByFids,
  lookupFidByWalletAddress,
} from "@/lib/farcaster/neynar";
import { isAddressLike } from "@/lib/wallet-score/formatters";
import { parseNeynarUserProfile } from "@/lib/task2earn/verification-logic";
import { NextResponse } from "next/server";

/**
 * Read-only Neynar score for the connected wallet. No DB writes.
 */
export async function GET(request: Request) {
  const address = new URL(request.url).searchParams.get("address")?.trim() ?? "";
  if (!isAddressLike(address)) {
    return NextResponse.json(
      { neynarScore: null, fid: null },
      { status: 400 },
    );
  }

  try {
    const fid = await lookupFidByWalletAddress(address);
    if (!fid) {
      return NextResponse.json({ neynarScore: null, fid: null });
    }
    const profile = parseNeynarUserProfile(await fetchUsersByFids([fid]), fid);
    return NextResponse.json({
      neynarScore: profile?.score ?? null,
      fid,
    });
  } catch {
    return NextResponse.json({ neynarScore: null, fid: null });
  }
}
