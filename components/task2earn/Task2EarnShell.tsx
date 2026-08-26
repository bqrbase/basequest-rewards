import PageShell from "@/components/PageShell";
import TaskNav from "@/components/task2earn/TaskNav";
import UnfundedNotice from "@/components/task2earn/UnfundedNotice";
import type { ReactNode } from "react";

type Task2EarnShellProps = {
  children: ReactNode;
  /** Marketplace-only chrome rendered above the shared Task2Earn nav. */
  beforeNav?: ReactNode;
};

export default function Task2EarnShell({
  children,
  beforeNav,
}: Task2EarnShellProps) {
  return (
    <PageShell>
      <div className="relative isolate">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-6 h-40 overflow-hidden"
        >
          <div className="absolute left-4 top-0 size-28 rounded-full bg-fuchsia-500/15 blur-3xl" />
          <div className="absolute right-8 top-2 size-24 rounded-full bg-cyan-400/15 blur-3xl" />
          <div className="absolute left-1/2 top-4 size-20 -translate-x-1/2 rounded-full bg-violet-500/15 blur-3xl" />
        </div>
        <div className="relative flex flex-col gap-4">
          <UnfundedNotice />
          {beforeNav}
          <TaskNav />
          {children}
        </div>
      </div>
    </PageShell>
  );
}
