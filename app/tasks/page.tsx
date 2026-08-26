import ShareRewardsCard from "@/components/task2earn/ShareRewardsCard";
import Task2EarnShell from "@/components/task2earn/Task2EarnShell";
import Link from "next/link";

export default function TasksPage() {
  return (
    <Task2EarnShell>
      <header>
        <p className="text-[0.62rem] font-bold uppercase tracking-[0.2em] text-cyan-200/60">
          Task2Earn
        </p>
        <h1 className="mt-1 font-sans text-xl font-bold text-white">
          BQR Share Rewards
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-white/55">
          Share the Mini App to claim today&apos;s free BQR drop. No task required.
        </p>
      </header>
      <ShareRewardsCard />
      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/tasks/browse"
          className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-[0.7rem] font-semibold tracking-wide text-white/70 transition-colors hover:border-white/16 hover:text-white"
        >
          Browse tasks
        </Link>
        <Link
          href="/tasks/create"
          className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-[0.7rem] font-semibold tracking-wide text-white/70 transition-colors hover:border-white/16 hover:text-white"
        >
          Create Task
        </Link>
      </div>
    </Task2EarnShell>
  );
}
