import {
  getTaskRequirements,
  REQUIREMENT_LABELS,
  TASK_TYPE_LABELS,
} from "@/lib/task2earn/display";
import type { TaskType } from "@/lib/task2earn/types";

type TaskRequirementsProps = {
  taskType: TaskType;
};

export default function TaskRequirements({ taskType }: TaskRequirementsProps) {
  const requirements = getTaskRequirements(taskType);

  return (
    <section>
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-white/45">
        Requirements
      </p>
      <p className="mt-1 text-sm text-white/60">
        {TASK_TYPE_LABELS[taskType]}
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {requirements.map((requirement) => {
          const label =
            requirement === "share_cast" || requirement === "share_snap"
              ? requirement
              : REQUIREMENT_LABELS[requirement];
          return (
            <li
              key={requirement}
              className="flex min-h-10 items-center rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white/85"
            >
              {label}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
