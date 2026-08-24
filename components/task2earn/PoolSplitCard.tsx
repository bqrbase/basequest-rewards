import {
  formatTokenAmount,
  parseNumericAmount,
} from "@/lib/task2earn/display";
import type { RewardToken } from "@/lib/task2earn/types";

type PoolSplitCardProps = {
  poolAmount: string;
  rewardToken: RewardToken;
  verifiedCount: number;
  estimatedRewardPerUser: string | null;
  campaignEnded: boolean;
};

export default function PoolSplitCard({
  poolAmount,
  rewardToken,
  verifiedCount,
  estimatedRewardPerUser,
  campaignEnded,
}: PoolSplitCardProps) {
  const divisor = verifiedCount > 0 ? verifiedCount : 1;
  const estimated = estimatedRewardPerUser
    ? formatTokenAmount(estimatedRewardPerUser, rewardToken)
    : "—";

  return (
    <section className="rounded-2xl border border-amber-400/20 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent p-4 shadow-[0_0_24px_rgba(245,158,11,0.12)]">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-amber-200/80">
        Pool split reward
      </p>
      <p className="mt-2 text-sm leading-relaxed text-white/80">
        Pool ÷ Verified Participants = Reward per user
      </p>
      <p className="mt-3 font-mono text-sm text-white/70">
        {formatTokenAmount(poolAmount, rewardToken)} ÷ {divisor}
        {verifiedCount === 0 ? " (first verifier)" : ""}
      </p>
      <p className="mt-2 font-sans text-xl font-bold text-amber-100">
        {estimated}
      </p>
      <p className="mt-1 text-[0.7rem] font-semibold uppercase tracking-wide text-amber-200/70">
        {campaignEnded ? "Final split pending escrow" : "ESTIMATED until campaign ends"}
      </p>
      <p className="mt-2 text-[0.7rem] leading-relaxed text-white/45">
        Not funded or claimable. {parseNumericAmount(poolAmount) === 0
          ? "No pool configured."
          : "Configured task data only."}
      </p>
    </section>
  );
}
