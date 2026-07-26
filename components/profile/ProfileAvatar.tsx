"use client";

import { useAvatar, useName } from "@coinbase/onchainkit/identity";
import { getAvatarLabel } from "@/lib/wallet-score/formatters";
import type { Address } from "viem";
import { base } from "viem/chains";

type ProfileAvatarProps = {
  address: string;
  sizeClassName?: string;
};

function GeneratedAvatar({
  address,
  sizeClassName,
}: {
  address: string;
  sizeClassName: string;
}) {
  return (
    <div
      aria-hidden
      className={`flex items-center justify-center rounded-full border border-cyan-200/25 bg-gradient-to-br from-base-blue via-indigo-600 to-violet-700 font-bold text-white shadow-[0_0_24px_rgba(0,82,255,0.4)] ${sizeClassName}`}
    >
      {getAvatarLabel(address)}
    </div>
  );
}

/**
 * ENS / Base Name avatar when available; otherwise generated wallet avatar.
 */
export default function ProfileAvatar({
  address,
  sizeClassName = "size-20 text-xl sm:size-24 sm:text-2xl",
}: ProfileAvatarProps) {
  const nameQuery = useName(
    {
      address: address as Address,
      chain: base,
    },
    { enabled: Boolean(address) },
  );

  const avatarQuery = useAvatar(
    {
      ensName: nameQuery.data ?? "",
      chain: base,
    },
    { enabled: Boolean(nameQuery.data) },
  );

  const isLoading =
    nameQuery.isLoading || (Boolean(nameQuery.data) && avatarQuery.isLoading);

  if (isLoading) {
    return (
      <div
        className={`${sizeClassName} animate-pulse rounded-full border border-white/10 bg-white/10`}
        aria-hidden
      />
    );
  }

  if (nameQuery.data && avatarQuery.data) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote ENS/Basename avatar URL
      <img
        src={avatarQuery.data}
        alt={nameQuery.data}
        className={`${sizeClassName} rounded-full border border-cyan-200/25 object-cover shadow-[0_0_24px_rgba(0,82,255,0.35)]`}
      />
    );
  }

  return <GeneratedAvatar address={address} sizeClassName={sizeClassName} />;
}
