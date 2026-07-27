import { NextResponse } from "next/server";

const APP_URL = "https://basequest.online";

const farcasterManifest = {
  accountAssociation: {
    header:
      "eyJmaWQiOjM2ODU5MSwidHlwZSI6ImN1c3RvZHkiLCJrZXkiOiIweDcyNkMyMjY1RmQxODVhRTRCNTg4NWE5MkM5ODk2Y0M0OTY0MjcxNTMifQ",
    payload: "eyJkb21haW4iOiJiYXNlcXVlc3Qub25saW5lIn0",
    signature:
      "51JVTqMppuPyhxqucbEkd83YfnzWvSMM9p4ioyMVeiltz9cLhtpCXo31CiFeVGxulLdUPJcqgsciS0FWJ+6GuBs=",
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
