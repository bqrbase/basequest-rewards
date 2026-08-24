"use client";

import PoolSplitCard from "@/components/task2earn/PoolSplitCard";
import {
  CAMPAIGN_DURATION_DAYS,
  CAMPAIGN_RULES,
  getCampaignRules,
  REWARD_TOKENS,
} from "@/lib/task2earn/constants";
import {
  DURATION_CREATE_LABELS,
  estimateRewardPerUser,
  formatTokenAmount,
  formatUsdAmount,
  parseNumericAmount,
  REWARD_TOKEN_BADGE_CLASS,
} from "@/lib/task2earn/display";
import { parsePoolAmount } from "@/lib/task2earn/validate";
import type {
  CampaignDuration,
  RewardToken,
  TokenUsdPrices,
} from "@/lib/task2earn/types";

const inputClass =
  "w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white placeholder:text-white/35 outline-none focus:border-cyan-400/40";

type RewardStepProps = {
  rewardToken: RewardToken;
  onRewardToken: (token: RewardToken) => void;
  poolAmount: string;
  onPoolAmount: (value: string) => void;
  durationDays: CampaignDuration;
  onDurationDays: (value: CampaignDuration) => void;
  prices: TokenUsdPrices | undefined;
  endsAt: Date;
};

function usdLabel(value: number | null): string {
  if (value === null) {
    return "USD estimate unavailable";
  }
  return formatUsdAmount(value);
}

export default function RewardStep({
  rewardToken,
  onRewardToken,
  poolAmount,
  onPoolAmount,
  durationDays,
  onDurationDays,
  prices,
  endsAt,
}: RewardStepProps) {
  const rules = getCampaignRules(durationDays);
  const amount = parsePoolAmount(poolAmount);
  const rate = prices?.[rewardToken] ?? null;
  const poolUsd =
    amount !== null && rate !== null ? amount * rate : null;
  const totalFunding =
    poolUsd !== null ? poolUsd + rules.feeUsd : null;
  const estimated = estimateRewardPerUser(amount ?? 0, 0);

  return (
    <div className="flex flex-col gap-5">
      <fieldset>
        <legend className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-white/45">
          Reward Token
        </legend>
        <div className="mt-2 flex gap-1.5">
          {REWARD_TOKENS.map((token) => (
            <button
              key={token}
              type="button"
              onClick={() => onRewardToken(token)}
              className={`min-h-10 flex-1 rounded-full border px-3 text-sm font-bold ${
                rewardToken === token
                  ? REWARD_TOKEN_BADGE_CLASS[token]
                  : "border-white/10 bg-white/[0.04] text-white/60"
              }`}
            >
              {token}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-white/45">
          Total Pool
        </span>
        <input
          className={inputClass}
          inputMode="decimal"
          value={poolAmount}
          onChange={(event) => onPoolAmount(event.target.value)}
          placeholder="0.00"
        />
      </label>

      <fieldset>
        <legend className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-white/45">
          Campaign Duration
        </legend>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {CAMPAIGN_DURATION_DAYS.map((days) => {
            const selected = durationDays === days;
            const option = CAMPAIGN_RULES[days];
            return (
              <button
                key={days}
                type="button"
                onClick={() => onDurationDays(days)}
                className={`rounded-2xl border px-3 py-2.5 text-left ${
                  selected
                    ? "border-amber-300/40 bg-amber-500/15 text-amber-50"
                    : "border-white/10 bg-white/[0.04] text-white/70"
                }`}
              >
                <p className="text-sm font-bold">{DURATION_CREATE_LABELS[days]}</p>
                <p className="mt-1 text-[0.62rem] text-white/45">
                  Min {formatUsdAmount(option.minPoolUsd)} · Fee{" "}
                  {formatUsdAmount(option.feeUsd)}
                </p>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[0.7rem] text-white/50">
          Campaign End Date & Time:{" "}
          <span className="text-white">
            {endsAt.toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
        </p>
        <p className="text-[0.65rem] text-white/40">
          Campaign auto-closes after this period. Custom hours are not available.
        </p>
      </fieldset>

      <dl className="grid grid-cols-1 gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-[0.65rem] uppercase tracking-wide text-white/40">Token</dt>
          <dd className="font-semibold text-white">{rewardToken}</dd>
        </div>
        <div>
          <dt className="text-[0.65rem] uppercase tracking-wide text-white/40">
            Pool amount
          </dt>
          <dd className="font-semibold text-amber-100">
            {amount !== null ? formatTokenAmount(amount, rewardToken) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[0.65rem] uppercase tracking-wide text-white/40">
            Estimated USD
          </dt>
          <dd className="font-semibold text-white">{usdLabel(poolUsd)}</dd>
        </div>
        <div>
          <dt className="text-[0.65rem] uppercase tracking-wide text-white/40">
            Minimum required USD
          </dt>
          <dd className="font-semibold text-white">{formatUsdAmount(rules.minPoolUsd)}</dd>
        </div>
        <div>
          <dt className="text-[0.65rem] uppercase tracking-wide text-white/40">
            Campaign fee
          </dt>
          <dd className="font-semibold text-white">{formatUsdAmount(rules.feeUsd)}</dd>
        </div>
        <div>
          <dt className="text-[0.65rem] uppercase tracking-wide text-white/40">
            Total funding requirement
          </dt>
          <dd className="font-semibold text-white">{usdLabel(totalFunding)}</dd>
        </div>
      </dl>
      <p className="text-[0.7rem] text-amber-100/80">
        Not funded yet. No tokens will be transferred.
      </p>

      <PoolSplitCard
        poolAmount={String(amount ?? (parseNumericAmount(poolAmount) || 0))}
        rewardToken={rewardToken}
        verifiedCount={0}
        estimatedRewardPerUser={estimated === null ? null : String(estimated)}
        campaignEnded={false}
      />
      <p className="text-[0.7rem] leading-relaxed text-white/50">
        Creator sets a Total Reward Pool. Pool is split equally among verified
        participants. Rewards are distributed after campaign ends. Participants
        claim later from My Tasks. Use estimated reward per user until the
        campaign ends.
      </p>
    </div>
  );
}
