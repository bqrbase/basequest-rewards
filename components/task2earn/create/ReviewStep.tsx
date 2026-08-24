"use client";

import AudienceBadge from "@/components/task2earn/AudienceBadge";
import ShareActions from "@/components/task2earn/ShareActions";
import { getCampaignRules } from "@/lib/task2earn/constants";
import {
  DURATION_CREATE_LABELS,
  formatTokenAmount,
  formatUsdAmount,
  TASK_TYPE_CREATE_LABELS,
} from "@/lib/task2earn/display";
import { formatTaskTargetSummary } from "@/lib/task2earn/target";
import { parsePoolAmount } from "@/lib/task2earn/validate";
import type {
  AudienceRules,
  CampaignDuration,
  RewardToken,
  TaskTarget,
  TaskType,
  TokenUsdPrices,
} from "@/lib/task2earn/types";

type ReviewStepProps = {
  taskType: TaskType;
  target: TaskTarget | null;
  audience: AudienceRules;
  rewardToken: RewardToken;
  poolAmount: string;
  durationDays: CampaignDuration;
  title: string;
  prices: TokenUsdPrices | undefined;
  endsAt: Date;
};

function usdLabel(value: number | null): string {
  if (value === null) {
    return "USD estimate unavailable";
  }
  return formatUsdAmount(value);
}

export default function ReviewStep({
  taskType,
  target,
  audience,
  rewardToken,
  poolAmount,
  durationDays,
  title,
  prices,
  endsAt,
}: ReviewStepProps) {
  const rules = getCampaignRules(durationDays);
  const amount = parsePoolAmount(poolAmount);
  const rate = prices?.[rewardToken] ?? null;
  const poolUsd =
    amount !== null && rate !== null ? amount * rate : null;

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-1 gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm">
        <div>
          <dt className="text-[0.65rem] uppercase tracking-wide text-white/40">
            Task Type
          </dt>
          <dd className="font-semibold text-white">
            {TASK_TYPE_CREATE_LABELS[taskType]}
          </dd>
        </div>
        <div>
          <dt className="text-[0.65rem] uppercase tracking-wide text-white/40">
            Target
          </dt>
          <dd className="break-all font-semibold text-white">
            {formatTaskTargetSummary(target)}
          </dd>
        </div>
        <div>
          <dt className="text-[0.65rem] uppercase tracking-wide text-white/40">
            Audience
          </dt>
          <dd className="mt-1">
            <AudienceBadge
              rules={audience}
              emptyLabel="No audience restrictions"
            />
          </dd>
        </div>
        <div>
          <dt className="text-[0.65rem] uppercase tracking-wide text-white/40">
            Reward Token
          </dt>
          <dd className="font-semibold text-white">{rewardToken}</dd>
        </div>
        <div>
          <dt className="text-[0.65rem] uppercase tracking-wide text-white/40">
            Total Pool
          </dt>
          <dd className="font-semibold text-amber-100">
            {amount !== null ? formatTokenAmount(amount, rewardToken) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[0.65rem] uppercase tracking-wide text-white/40">
            Campaign Duration
          </dt>
          <dd className="font-semibold text-white">
            {DURATION_CREATE_LABELS[durationDays]}
          </dd>
        </div>
        <div>
          <dt className="text-[0.65rem] uppercase tracking-wide text-white/40">
            Campaign Fee
          </dt>
          <dd className="font-semibold text-white">{formatUsdAmount(rules.feeUsd)}</dd>
        </div>
        <div>
          <dt className="text-[0.65rem] uppercase tracking-wide text-white/40">
            Minimum Pool Requirement
          </dt>
          <dd className="font-semibold text-white">
            {formatUsdAmount(rules.minPoolUsd)}
          </dd>
        </div>
        <div>
          <dt className="text-[0.65rem] uppercase tracking-wide text-white/40">
            Campaign End
          </dt>
          <dd className="font-semibold text-white">
            {endsAt.toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </dd>
        </div>
        <div>
          <dt className="text-[0.65rem] uppercase tracking-wide text-white/40">
            Pool Split Policy
          </dt>
          <dd className="font-semibold text-white">
            Equal split among verified participants
          </dd>
        </div>
        <div>
          <dt className="text-[0.65rem] uppercase tracking-wide text-white/40">
            Estimated USD
          </dt>
          <dd className="font-semibold text-white">{usdLabel(poolUsd)}</dd>
        </div>
      </dl>

      <p className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-100">
        Not funded yet
      </p>
      <p className="text-sm leading-relaxed text-white/60">
        This creates an off-chain task draft. No tokens will be transferred.
      </p>

      <ShareActions title={title || "Task2Earn draft"} compact={false} />
    </div>
  );
}
