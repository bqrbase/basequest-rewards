"use client";

import JesseCatMintModal from "@/components/JesseCatMintModal";
import type { QuestProgress } from "@/lib/quest-engine";
import { ArrowRight, Check } from "lucide-react";
import { useState } from "react";

const JESSECAT_ARTWORK_URL =
  "https://i2c.seadn.io/collection/jessecat-720030255/image_type_logo/a59c4d6ee361d3d011e41c7a37905e/0ea59c4d6ee361d3d011e41c7a37905e.png";

type JesseCatMintBannerProps = {
  onCompleted: (progress: QuestProgress) => void;
};

function Sparkle({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute text-violet-200/90 ${className}`}
    >
      ✦
    </span>
  );
}

/**
 * Promotional JesseCat mint banner. Opens the same JesseCatMintModal
 * used by JesseCatMintCard (`setOpen(true)`).
 */
export default function JesseCatMintBanner({
  onCompleted,
}: JesseCatMintBannerProps) {
  const [open, setOpen] = useState(false);

  function openMintModal() {
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={openMintModal}
        aria-label="Mint JesseCat now"
        className="group relative isolate w-full overflow-hidden rounded-2xl border border-violet-400/55 bg-[linear-gradient(135deg,#14081f_0%,#1c0d32_42%,#12091c_100%)] px-2.5 py-2 text-left shadow-[0_0_0_1px_rgba(192,132,252,0.18),0_8px_28px_rgba(109,40,217,0.38),0_0_42px_rgba(139,92,246,0.28)] transition-transform duration-200 hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/80 sm:px-4 sm:py-3"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_50%,rgba(168,85,247,0.28),transparent_42%)]"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -left-10 top-0 h-full w-28 bg-[radial-gradient(circle,rgba(124,58,237,0.22),transparent_70%)]"
        />

        <span className="relative z-[1] grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1.5 sm:gap-3">
          <span className="min-w-0">
            <span className="inline-flex rounded-full bg-violet-600 px-2 py-0.5 text-[0.55rem] font-bold uppercase tracking-[0.14em] text-white shadow-[0_0_12px_rgba(139,92,246,0.55)]">
              NEW
            </span>
            <span className="mt-1.5 block whitespace-nowrap font-sans text-[clamp(0.82rem,4.4vw,1.35rem)] font-black uppercase leading-none tracking-tight text-white sm:tracking-wider">
              Mint JesseCat
            </span>
            <span className="mt-1.5 inline-flex whitespace-nowrap rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-2 py-0.5 text-[0.58rem] font-semibold text-white shadow-[0_0_10px_rgba(168,85,247,0.45)] sm:text-xs">
              +100 XP per mint
            </span>
            <span className="mt-1.5 block whitespace-nowrap text-[0.62rem] font-medium text-white/70 sm:text-xs">
              15,000 Unique NFTs
            </span>
          </span>

          <span className="relative shrink-0">
            <Sparkle className="-left-2 -top-1 text-[0.55rem]" />
            <Sparkle className="-right-1 top-1 text-[0.45rem] text-fuchsia-200/80" />
            <Sparkle className="bottom-1 -left-1 text-[0.4rem] text-violet-100/70" />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-[-12%] rounded-full bg-[radial-gradient(circle,rgba(192,132,252,0.45),transparent_68%)] blur-md"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={JESSECAT_ARTWORK_URL}
              alt=""
              width={112}
              height={112}
              className="relative z-[1] h-[clamp(3.4rem,18vw,5.5rem)] w-[clamp(3.4rem,18vw,5.5rem)] object-contain drop-shadow-[0_0_18px_rgba(168,85,247,0.65)]"
            />
            <span className="absolute -bottom-0.5 -left-0.5 z-[2] flex size-5 items-center justify-center bg-gradient-to-br from-violet-500 to-fuchsia-600 text-[0.5rem] font-black text-white shadow-[0_0_10px_rgba(139,92,246,0.7)] [clip-path:polygon(50%_0%,93%_25%,93%_75%,50%_100%,7%_75%,7%_25%)] sm:size-7 sm:text-[0.62rem]">
              JC
            </span>
          </span>

          <span className="flex shrink-0 flex-col items-end gap-1">
            <span className="inline-flex items-center gap-0.5 whitespace-nowrap rounded-full bg-gradient-to-r from-violet-500 via-indigo-500 to-blue-500 px-2 py-1.5 text-[0.58rem] font-bold uppercase tracking-wide text-white shadow-[0_6px_18px_rgba(99,102,241,0.45)] transition-opacity group-hover:opacity-95 sm:gap-1 sm:px-3 sm:text-xs">
              Mint now
              <ArrowRight className="size-3 sm:size-4" strokeWidth={2.5} />
            </span>
            <span className="inline-flex items-center gap-1 whitespace-nowrap text-[0.55rem] font-medium text-white/75 sm:text-[0.65rem]">
              Official Drop
              <span className="inline-flex size-3.5 items-center justify-center rounded-full bg-[#0052FF] sm:size-4">
                <Check className="size-2.5 text-white" strokeWidth={3.5} />
              </span>
            </span>
          </span>
        </span>
      </button>

      <JesseCatMintModal
        open={open}
        onClose={() => setOpen(false)}
        onCompleted={onCompleted}
      />
    </>
  );
}
