"use client";

import GenesisXPRewardDisplay from "@/components/genesis/GenesisXPRewardDisplay";
import GlassPanel from "@/components/GlassPanel";
import type { GenesisQuestViewModel } from "@/lib/genesis/quests";
import { ui } from "@/lib/ui-styles";

type GenesisQuestCardProps = {
  quest: GenesisQuestViewModel;
};

/**
 * Disabled Genesis exclusive quest card — visible only, no claiming.
 */
export default function GenesisQuestCard({ quest }: GenesisQuestCardProps) {
  return (
    <GlassPanel className={`h-full ${ui.dashCardPad} opacity-95`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[0.6rem] font-semibold uppercase tracking-widest text-white/45 sm:px-3 sm:text-[0.65rem]">
            Disabled
          </span>
          <span className="rounded-full border border-cyan-300/35 bg-cyan-500/15 px-2.5 py-1 text-[0.6rem] font-semibold uppercase tracking-widest text-cyan-100 sm:px-3 sm:text-[0.65rem]">
            {quest.exclusiveLabel}
          </span>
        </div>
        <GenesisXPRewardDisplay
          baseXP={quest.rewardXp}
          rewardLabel={quest.rewardLabel}
          variant="compact"
        />
      </div>

      <div className="mt-4 flex flex-1 flex-col border-t border-white/[0.06] pt-4">
        <h3 className="font-sans text-base font-semibold tracking-tight text-white sm:text-lg">
          {quest.title}
        </h3>
        <p className="mt-2 flex-1 text-sm leading-6 text-white/55 sm:leading-7">
          {quest.description}
        </p>
      </div>

      <div className="pt-4 sm:pt-5">
        <button
          type="button"
          disabled
          aria-disabled="true"
          className={`${ui.secondaryButton} w-full cursor-not-allowed opacity-70`}
        >
          {quest.ctaLabel}
        </button>
      </div>
    </GlassPanel>
  );
}
