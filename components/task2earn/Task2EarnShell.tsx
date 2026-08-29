import PageShell from "@/components/PageShell";
import TaskNav from "@/components/task2earn/TaskNav";
import UnfundedNotice from "@/components/task2earn/UnfundedNotice";
import type { ReactNode } from "react";

type Task2EarnShellProps = {
  children: ReactNode;
  showUnfundedNotice?: boolean;
};

export default function Task2EarnShell({
  children,
  showUnfundedNotice = true,
}: Task2EarnShellProps) {
  return (
    <PageShell>
      <div className="relative isolate">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-4 h-28 overflow-hidden"
        >
          <div className="absolute left-2 top-0 size-24 rounded-full bg-violet-600/25 blur-3xl" />
          <div className="absolute right-6 top-1 size-20 rounded-full bg-base-blue/20 blur-3xl" />
        </div>
        <div className="relative flex flex-col gap-2.5">
          {showUnfundedNotice ? <UnfundedNotice /> : null}
          <TaskNav />
          {children}
        </div>
      </div>
    </PageShell>
  );
}
