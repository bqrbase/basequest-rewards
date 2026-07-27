import { NextResponse } from "next/server";

const APP_URL = "https://basequest.online";

const farcasterManifest = {
  accountAssociation: {
    header:
      "eyJmaWQiOjM2ODU5MSwidHlwZSI6ImN1c3RvZHkiLCJrZXkiOiIweDVFNjA0MzlGYThFMjQ4OTEwQjk5RjYzMzI2NjY4RjhiNDJlRjg2NjQifQ",
    payload: "eyJkb21haW4iOiJiYXNlcXVlc3Qub25saW5lIn0",
    signature:
      "fBibcer5cNPi9Cw//bUKeep/D2LnwYVYDEyrgrSB8L9UpAEXiQJX5Q2D6UcxWfLW5iqmhs+F0wYU2tpXSrvCCRs=",
  },
  miniapp: {
    version: "1",
    name: "BaseQuest Rewards",
    homeUrl: `${APP_URL}/`,
    iconUrl: `${APP_URL}/app-icon.png`,
    imageUrl: `${APP_URL}/og-image.png`,
    splashImageUrl: `${APP_URL}/splash.png`,
    splashBackgroundColor: "#0052FF",
    subtitle: "Daily rewards on Base",
    description:
      "Complete quests. Earn XP. Unlock rewards on the Base ecosystem.",
    primaryCategory: "finance",
    heroImageUrl: `${APP_URL}/hero.png`,
    screenshotUrls: [
      `${APP_URL}/screenshots/home.png`,
      `${APP_URL}/screenshots/quests.png`,
      `${APP_URL}/screenshots/leaderboard.png`,
    ],
  },
} as const;

export function GET() {
  return NextResponse.json(farcasterManifest);
}
