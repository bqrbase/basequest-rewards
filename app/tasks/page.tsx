"use client";

import Task2EarnShell from "@/components/task2earn/Task2EarnShell";
import TaskMarketplace from "@/components/task2earn/TaskMarketplace";
import Link from "next/link";

export default function TasksPage() {
  return (
    <Task2EarnShell
      beforeNav={
        <>
          <header className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-3 backdrop-blur-md">
            <div
              aria-hidden
              className="pointer-events-none absolute -left-6 -top-8 size-24 rounded-full bg-base-blue/30 blur-3xl"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -right-4 top-0 size-16 rounded-full bg-cyan-400/20 blur-3xl"
            />
            <p className="relative text-[0.62rem] font-bold uppercase tracking-[0.22em] text-cyan-200/70">
              TASK2EARN
            </p>
            <h1 className="relative mt-1 font-sans text-[1.35rem] font-bold leading-tight tracking-tight text-white sm:text-2xl">
              Earn BQR by completing social tasks
            </h1>
            <p className="relative mt-1.5 max-w-xl text-[0.8rem] leading-snug text-white/55">
              Browse live campaigns, complete the action, and earn from the
              reward pool.
            </p>
          </header>
          <Link
            href="/tasks/create"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-base-blue via-[#3b6cff] to-indigo-600 text-[0.78rem] font-bold uppercase tracking-[0.16em] text-white shadow-[0_10px_24px_rgba(0,82,255,0.42)] ring-1 ring-white/20 transition-all duration-200 hover:-translate-y-px hover:shadow-[0_14px_28px_rgba(0,82,255,0.5)]"
          >
            ✨ CREATE TASK
          </Link>
        </>
      }
    >
      <TaskMarketplace />
    </Task2EarnShell>
  );
}
