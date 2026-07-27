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
    // Deprecated feed embed fields (kept for older clients).
    imageUrl: `${APP_URL}/embed-image.png`,
    buttonTitle: "Open BaseQuest",
    splashImageUrl: `${APP_URL}/splash-icon.png`,
    splashBackgroundColor: "#070b18",
    webhookUrl: `${APP_URL}/api/webhook`,
    subtitle: "Daily rewards on Base",
    description:
      "Complete quests. Earn XP. Unlock rewards on the Base ecosystem.",
    primaryCategory: "finance",
    tags: ["base", "quests", "rewards", "xp", "web3"],
    heroImageUrl: `${APP_URL}/hero.png`,
    tagline: "Quests into rewards",
    ogTitle: "BaseQuest Rewards",
    ogDescription: "Complete quests. Earn XP. Unlock rewards on Base.",
    ogImageUrl: `${APP_URL}/og-image.png`,
    screenshotUrls: [
      `${APP_URL}/screenshots/home.png`,
      `${APP_URL}/screenshots/quests.png`,
      `${APP_URL}/screenshots/leaderboard.png`,
    ],
    requiredChains: ["eip155:8453"],
    requiredCapabilities: ["wallet.getEthereumProvider"],
    canonicalDomain: "basequest.online",
  },
} as const;

export function GET() {
  return NextResponse.json(farcasterManifest);
}
