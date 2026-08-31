import Task2EarnShell from "@/components/task2earn/Task2EarnShell";
import TaskMarketplace from "@/components/task2earn/TaskMarketplace";

export default function JoinedTasksPage() {
  return (
    <Task2EarnShell>
      <TaskMarketplace scope="joined" />
    </Task2EarnShell>
  );
}
