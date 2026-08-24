"use client";

import Task2EarnShell from "@/components/task2earn/Task2EarnShell";
import TaskDetails from "@/components/task2earn/TaskDetails";
import { use } from "react";

type TaskPageProps = {
  params: Promise<{ id: string }>;
};

export default function TaskDetailPage({ params }: TaskPageProps) {
  const { id } = use(params);

  return (
    <Task2EarnShell>
      <TaskDetails taskId={id} />
    </Task2EarnShell>
  );
}
