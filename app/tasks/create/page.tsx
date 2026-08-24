"use client";

import CreateTaskWizard from "@/components/task2earn/CreateTaskWizard";
import Task2EarnShell from "@/components/task2earn/Task2EarnShell";

export default function CreateTaskPage() {
  return (
    <Task2EarnShell>
      <header>
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-cyan-200/50">
          Task2Earn
        </p>
        <h1 className="mt-1 font-sans text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Create Task
        </h1>
        <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-white/55">
          Configure an off-chain task draft. Ready for future escrow — no tokens
          are transferred in this step.
        </p>
      </header>
      <CreateTaskWizard />
    </Task2EarnShell>
  );
}
