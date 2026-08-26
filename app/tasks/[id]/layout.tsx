import {
  buildMiniAppEmbedTags,
  canonicalTaskShareImageUrl,
  canonicalTaskUrl,
} from "@/lib/miniapp/share";
import type { Metadata } from "next";
import type { ReactNode } from "react";

type TaskIdLayoutProps = {
  children: ReactNode;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const url = canonicalTaskUrl(id);
  const imageUrl = canonicalTaskShareImageUrl(id);
  return {
    alternates: { canonical: url },
    openGraph: {
      url,
      images: [{ url: imageUrl, width: 1200, height: 800 }],
    },
    twitter: {
      card: "summary_large_image",
      images: [imageUrl],
    },
    other: buildMiniAppEmbedTags({
      url,
      buttonTitle: "Complete Task",
      imageUrl,
    }),
  };
}

export default function TaskIdLayout({ children }: TaskIdLayoutProps) {
  return children;
}
