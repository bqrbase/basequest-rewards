import MiniAppReady from "@/components/MiniAppReady";
import Providers from "@/components/Providers";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const APP_URL = "https://basequest.online";
const APP_TITLE = "BaseQuest Rewards";
const APP_DESCRIPTION =
  "Daily rewards and engagement for the Base ecosystem. Complete quests, earn XP, and unlock rewards.";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: APP_TITLE,
  description: APP_DESCRIPTION,
  applicationName: APP_TITLE,

  icons: {
    icon: [{ url: `${APP_URL}/app-icon.png`, sizes: "1024x1024", type: "image/png" }],
    apple: [{ url: `${APP_URL}/app-icon.png`, sizes: "1024x1024", type: "image/png" }],
    shortcut: `${APP_URL}/app-icon.png`,
  },
  openGraph: {
    type: "website",
    url: APP_URL,
    title: APP_TITLE,
    description: APP_DESCRIPTION,
    siteName: APP_TITLE,
    images: [
      {
        url: `${APP_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "BaseQuest Rewards — Complete quests. Earn XP. Unlock rewards.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: APP_TITLE,
    description: APP_DESCRIPTION,
    images: [`${APP_URL}/og-image.png`],
  },
 other: {
  "base:app_id": "6a5e99b82ef8a18fb639b9e7",
  "talentapp:project_verification":
    "e35d8a3bd02b677c010c6b220a93256e7b18c71ab5d78353998d8be6d8cbf5669014b9431efc8d86356f582d8949f3c27e4b865263d954eec69af1a4fd011293",
},
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <body className="min-h-dvh">
        <Providers>
          <MiniAppReady />
          {children}
        </Providers>
      </body>
    </html>
  );
}
