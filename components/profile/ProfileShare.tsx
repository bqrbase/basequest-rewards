"use client";

import GlassPanel from "@/components/GlassPanel";
import { ui } from "@/lib/ui-styles";
import { useMemo, useState } from "react";

type ProfileShareProps = {
  address: string;
  basename: string | null;
  level: number;
  totalXp: number;
};

export default function ProfileShare({
  address,
  basename,
  level,
  totalXp,
}: ProfileShareProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  const profileUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return "/profile";
    }
    return `${window.location.origin}/profile`;
  }, []);

  const shareText = useMemo(() => {
    const identity = basename ?? `${address.slice(0, 6)}…${address.slice(-4)}`;
    return `Check out my BaseQuest Rewards profile — ${identity} · Level ${level} · ${totalXp.toLocaleString()} XP`;
  }, [address, basename, level, totalXp]);

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      setCopiedLink(false);
    }
  }

  async function handleShare() {
    setShareMessage(null);

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "BaseQuest Rewards Profile",
          text: shareText,
          url: profileUrl,
        });
        setShareMessage("Shared");
        window.setTimeout(() => setShareMessage(null), 2000);
        return;
      } catch {
        // User cancelled or share failed — fall through to clipboard.
      }
    }

    try {
      await navigator.clipboard.writeText(`${shareText}\n${profileUrl}`);
      setShareMessage("Copied share text");
      window.setTimeout(() => setShareMessage(null), 2000);
    } catch {
      setShareMessage("Unable to share");
      window.setTimeout(() => setShareMessage(null), 2000);
    }
  }

  return (
    <section className={ui.dashSection}>
      <div className={ui.sectionHeaderWrap}>
        <p className={ui.sectionHeading}>Share</p>
        <h2 className={ui.sectionTitle}>Share Profile</h2>
        <p className={ui.sectionDescription}>
          Share your BaseQuest progress with builders on Base and Farcaster.
        </p>
      </div>

      <GlassPanel className={ui.dashCardPad}>
        <p className="text-sm leading-relaxed text-white/55">{shareText}</p>
        <p className="mt-2 truncate font-mono text-xs text-white/35" title={profileUrl}>
          {profileUrl}
        </p>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => void handleShare()}
            className={`${ui.primaryButton} w-full sm:flex-1`}
          >
            {shareMessage === "Shared" ? "Shared!" : "Share Profile"}
          </button>
          <button
            type="button"
            onClick={() => void handleCopyLink()}
            className={`${ui.secondaryButton} w-full sm:flex-1`}
          >
            {copiedLink ? "Link Copied" : "Copy Profile Link"}
          </button>
        </div>

        {shareMessage && shareMessage !== "Shared" ? (
          <p className="mt-3 text-center text-xs text-white/45" aria-live="polite">
            {shareMessage}
          </p>
        ) : null}
      </GlassPanel>
    </section>
  );
}
