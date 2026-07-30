"use client";

import { useGenesisAccess } from "@/hooks/useGenesisAccess";
import type { Address } from "viem";

type GenesisBadgeProps = {
  /** Optional wallet override; defaults to the connected account. */
  address?: Address;
  className?: string;
};

/**
 * Glass UI badge shown when the wallet holds Genesis NFT #1.
 * Renders nothing while loading or when access denies holder status.
 */
export default function GenesisBadge({
  address,
  className = "",
}: GenesisBadgeProps) {
  const { isGenesisHolder, loading } = useGenesisAccess(address);

  if (loading || !isGenesisHolder) {
    return null;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-badge border border-cyan-300/35 bg-gradient-to-r from-base-blue/25 via-indigo-600/20 to-violet-700/25 px-2.5 py-1 text-[0.55rem] font-bold uppercase tracking-[0.14em] text-cyan-50 shadow-[0_0_16px_rgba(0,82,255,0.28)] ${className}`.trim()}
      title="BaseQuest Genesis holder"
    >
      <span
        aria-hidden
        className="size-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.8)]"
      />
      Genesis Holder
    </span>
  );
}
