"use client";

import Task2EarnShell from "@/components/task2earn/Task2EarnShell";
import TaskMarketplace from "@/components/task2earn/TaskMarketplace";

export default function TasksPage() {
  return (
    <Task2EarnShell>
      <header>
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-cyan-200/50">
          Task2Earn
        </p>
        <h1 className="mt-1 font-sans text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Marketplace
        </h1>
        <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-white/55">
          Social tasks on Farcaster. Pools are configured amounts only — not
          funded or claimable yet.
        </p>
      </header>
      <TaskMarketplace />
    </Task2EarnShell>
  );
}
