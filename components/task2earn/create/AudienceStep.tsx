"use client";

import AudienceBadge from "@/components/task2earn/AudienceBadge";
import {
  ACCOUNT_AGE_MINIMUM_OPTIONS,
  FOLLOWER_MINIMUM_OPTIONS,
} from "@/lib/task2earn/constants";
import { sanitizeAudience } from "@/lib/task2earn/validate";

const FOLLOWER_LABELS: Record<number, string> = {
  50: "50+",
  100: "100+",
  500: "500+",
  1000: "1K+",
  5000: "5K+",
  10000: "10K+",
};

type AudienceStepProps = {
  minFollowers: number | null;
  onMinFollowers: (value: number | null) => void;
  minNeynar: number;
  onMinNeynar: (value: number) => void;
  minAge: number | null;
  onMinAge: (value: number | null) => void;
  nonSpam: boolean;
  onNonSpam: (value: boolean) => void;
  photoRequired: boolean;
  onPhotoRequired: (value: boolean) => void;
};

function chipClass(active: boolean) {
  return `min-h-9 rounded-full border px-3 text-[0.7rem] font-semibold ${
    active
      ? "border-violet-300/40 bg-violet-500/25 text-violet-100"
      : "border-white/10 bg-white/[0.04] text-white/60"
  }`;
}

export default function AudienceStep({
  minFollowers,
  onMinFollowers,
  minNeynar,
  onMinNeynar,
  minAge,
  onMinAge,
  nonSpam,
  onNonSpam,
  photoRequired,
  onPhotoRequired,
}: AudienceStepProps) {
  const audience = sanitizeAudience({
    minimum_followers: minFollowers,
    minimum_neynar_score: minNeynar,
    minimum_account_age_days: minAge,
    non_spam_only: nonSpam,
    profile_photo_required: photoRequired,
  });

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-white/55">All filters are optional.</p>

      <fieldset>
        <legend className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-white/45">
          Minimum Followers
        </legend>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button
            type="button"
            className={chipClass(minFollowers === null)}
            onClick={() => onMinFollowers(null)}
          >
            None
          </button>
          {FOLLOWER_MINIMUM_OPTIONS.map((value) => (
            <button
              key={value}
              type="button"
              className={chipClass(minFollowers === value)}
              onClick={() => onMinFollowers(value)}
            >
              {FOLLOWER_LABELS[value]}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-white/45">
          Minimum Neynar Score
        </legend>
        <p className="mt-1 text-[0.7rem] text-white/40">
          {minNeynar > 0 ? minNeynar.toFixed(2) : "0.0 / disabled"}
        </p>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={minNeynar}
          onChange={(event) => onMinNeynar(Number(event.target.value))}
          className="mt-2 w-full accent-cyan-400"
        />
      </fieldset>

      <fieldset>
        <legend className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-white/45">
          Minimum Account Age
        </legend>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button
            type="button"
            className={chipClass(minAge === null)}
            onClick={() => onMinAge(null)}
          >
            None
          </button>
          {ACCOUNT_AGE_MINIMUM_OPTIONS.map((value) => (
            <button
              key={value}
              type="button"
              className={chipClass(minAge === value)}
              onClick={() => onMinAge(value)}
            >
              {value} Days
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-white/45">
          Additional Requirements
        </legend>
        <label className="flex items-center gap-2 text-sm text-white/80">
          <input
            type="checkbox"
            checked={nonSpam}
            onChange={(event) => onNonSpam(event.target.checked)}
            className="size-4 accent-cyan-400"
          />
          Non-Spam Only
        </label>
        <label className="flex items-center gap-2 text-sm text-white/80">
          <input
            type="checkbox"
            checked={photoRequired}
            onChange={(event) => onPhotoRequired(event.target.checked)}
            className="size-4 accent-cyan-400"
          />
          Profile Photo Required
        </label>
      </fieldset>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-white/40">
          Summary
        </p>
        <div className="mt-2">
          <AudienceBadge
            rules={audience}
            emptyLabel="No audience restrictions"
          />
        </div>
      </div>
    </div>
  );
}
