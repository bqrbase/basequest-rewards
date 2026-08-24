"use client";

import { TASK_TYPES } from "@/lib/task2earn/constants";
import {
  TASK_TYPE_BADGE_CLASS,
  TASK_TYPE_CREATE_LABELS,
} from "@/lib/task2earn/display";
import type { TaskType } from "@/lib/task2earn/types";

type TypeStepProps = {
  value: TaskType | null;
  onChange: (taskType: TaskType) => void;
};

export default function TypeStep({ value, onChange }: TypeStepProps) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {TASK_TYPES.map((taskType) => {
        const selected = value === taskType;
        return (
          <button
            key={taskType}
            type="button"
            onClick={() => onChange(taskType)}
            className={`rounded-2xl border px-3.5 py-3 text-left transition ${
              selected
                ? `${TASK_TYPE_BADGE_CLASS[taskType]} ring-1 ring-white/20`
                : "border-white/10 bg-white/[0.03] text-white/80 hover:border-white/20"
            }`}
          >
            <p className="text-sm font-bold">{TASK_TYPE_CREATE_LABELS[taskType]}</p>
            <p className="mt-1 text-[0.65rem] text-white/50">
              {taskType === "mini_app"
                ? "Open a Mini App"
                : taskType === "follow"
                  ? "Follow a Farcaster account"
                  : "Social action on a cast"}
            </p>
          </button>
        );
      })}
    </div>
  );
}
