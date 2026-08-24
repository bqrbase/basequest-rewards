import { TASK_TYPE_BADGE_CLASS, TASK_TYPE_LABELS } from "@/lib/task2earn/display";
import type { TaskType } from "@/lib/task2earn/types";

type TaskTypeBadgeProps = {
  taskType: TaskType;
};

export default function TaskTypeBadge({ taskType }: TaskTypeBadgeProps) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wide ${TASK_TYPE_BADGE_CLASS[taskType]}`}
    >
      {TASK_TYPE_LABELS[taskType]}
    </span>
  );
}
