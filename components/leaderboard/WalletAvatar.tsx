"use client";

import { walletAvatarColors, walletInitials } from "@/components/leaderboard/utils";

type WalletAvatarProps = {
  address: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZE_CLASS = {
  sm: "size-8 text-[0.55rem]",
  md: "size-10 text-[0.65rem]",
  lg: "size-12 text-xs sm:size-14 sm:text-sm",
} as const;

export function WalletAvatar({
  address,
  size = "md",
  className = "",
}: WalletAvatarProps) {
  const colors = walletAvatarColors(address);
  const initials = walletInitials(address);

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full border border-white/15 font-mono font-bold tracking-wide text-white shadow-[0_0_16px_rgba(0,82,255,0.18)] ${SIZE_CLASS[size]} ${className}`}
      style={{
        background: `linear-gradient(135deg, ${colors.from}, ${colors.to})`,
      }}
      aria-hidden
    >
      {initials}
    </span>
  );
}
