import { REWARD_TOKEN_BADGE_CLASS } from "@/lib/task2earn/display";
import type { RewardToken } from "@/lib/task2earn/types";

type RewardBadgeProps = {
  token: RewardToken;
};

export default function RewardBadge({ token }: RewardBadgeProps) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[0.62rem] font-bold tracking-wide ${REWARD_TOKEN_BADGE_CLASS[token]}`}
    >
      {token}
    </span>
  );
}
