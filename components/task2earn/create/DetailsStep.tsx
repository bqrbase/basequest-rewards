"use client";

import {
  DESCRIPTION_MAX_LENGTH,
  TITLE_MAX_LENGTH,
} from "@/lib/task2earn/constants";

const inputClass =
  "w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white placeholder:text-white/35 outline-none focus:border-cyan-400/40";

type DetailsStepProps = {
  title: string;
  onTitle: (value: string) => void;
  description: string;
  onDescription: (value: string) => void;
  maxParticipants: string;
  onMaxParticipants: (value: string) => void;
};

export default function DetailsStep({
  title,
  onTitle,
  description,
  onDescription,
  maxParticipants,
  onMaxParticipants,
}: DetailsStepProps) {
  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-white/45">
          Title
        </span>
        <input
          className={inputClass}
          value={title}
          onChange={(event) => onTitle(event.target.value)}
          maxLength={TITLE_MAX_LENGTH}
          placeholder="Give this task a clear name"
        />
        <span className="text-[0.62rem] text-white/35">
          {title.trim().length}/{TITLE_MAX_LENGTH}
        </span>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-white/45">
          Description
        </span>
        <textarea
          className={`${inputClass} min-h-28 resize-y`}
          value={description}
          onChange={(event) => onDescription(event.target.value)}
          maxLength={DESCRIPTION_MAX_LENGTH}
          placeholder="What should participants do?"
        />
        <span className="text-[0.62rem] text-white/35">
          {description.trim().length}/{DESCRIPTION_MAX_LENGTH}
        </span>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-white/45">
          Max participants (optional)
        </span>
        <input
          className={inputClass}
          inputMode="numeric"
          value={maxParticipants}
          onChange={(event) => onMaxParticipants(event.target.value)}
          placeholder="Unlimited"
        />
      </label>
    </div>
  );
}
