"use client";

import TaskCard from "@/components/task2earn/TaskCard";
import TaskFilters, {
  type MarketplaceSection,
} from "@/components/task2earn/TaskFilters";
import { fetchMarketplaceTasks, joinTaskRequest } from "@/lib/task2earn/client";
import { parseNumericAmount } from "@/lib/task2earn/display";
import type { TaskMarketplaceItem } from "@/lib/task2earn/types";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useCallback, useState } from "react";
import { useAccount } from "wagmi";

function sortTasks(
  tasks: TaskMarketplaceItem[],
  section: MarketplaceSection,
): TaskMarketplaceItem[] {
  const copy = [...tasks];
  switch (section) {
    case "popular":
      return copy.sort(
        (a, b) =>
          b.participantCount - a.participantCount ||
          Date.parse(b.createdAt) - Date.parse(a.createdAt),
      );
    case "new":
      return copy.sort(
        (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
      );
    case "ending":
      return copy.sort((a, b) => Date.parse(a.endsAt) - Date.parse(b.endsAt));
    case "rewards":
      return copy.sort(
        (a, b) =>
          parseNumericAmount(b.poolUsdValue) - parseNumericAmount(a.poolUsdValue) ||
          parseNumericAmount(b.poolAmount) - parseNumericAmount(a.poolAmount),
      );
  }
}

export default function TaskMarketplace() {
  const { address, status } = useAccount();
  const wallet = status === "connected" && address ? address : null;
  const [section, setSection] = useState<MarketplaceSection>("popular");
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [joinedIds, setJoinedIds] = useState<string[]>([]);
  const [joinHint, setJoinHint] = useState<string | null>(null);

  const tasksQuery = useQuery({
    queryKey: ["t2e-tasks"],
    queryFn: fetchMarketplaceTasks,
    staleTime: 15_000,
    retry: 1,
  });

  const tasks = tasksQuery.data ?? [];
  const visible = sortTasks(tasks, section);

  const onJoin = useCallback(
    async (taskId: string) => {
      if (!wallet) {
        setJoinHint("Connect your wallet to join. No rewards are paid yet.");
        return;
      }
      setJoiningId(taskId);
      setJoinHint(null);
      try {
        const result = await joinTaskRequest(taskId, wallet);
        setJoinedIds((current) =>
          current.includes(taskId) ? current : [...current, taskId],
        );
        setJoinHint(
          result.alreadyJoined
            ? "Already joined. No rewards transferred."
            : "Joined. No rewards transferred.",
        );
        await tasksQuery.refetch();
      } catch (joinError) {
        setJoinHint(
          joinError instanceof Error ? joinError.message : "Join failed",
        );
      } finally {
        setJoiningId(null);
      }
    },
    [tasksQuery, wallet],
  );

  if (tasksQuery.isPending) {
    return (
      <div className="grid grid-cols-1 gap-2.5">
        {Array.from({ length: 2 }, (_, index) => (
          <div
            key={index}
            className="min-h-[10.5rem] animate-pulse rounded-2xl border border-white/8 bg-white/[0.04]"
          />
        ))}
      </div>
    );
  }

  if (tasksQuery.isError) {
    return (
      <p className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-3 text-sm text-rose-100">
        {tasksQuery.error instanceof Error
          ? tasksQuery.error.message
          : "Unable to load tasks"}
      </p>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-5 text-center">
        <p className="text-2xl" aria-hidden>
          🎯
        </p>
        <p className="mt-1.5 text-base font-bold text-white">
          No live tasks yet
        </p>
        <p className="mt-1 text-[0.8rem] text-white/55">
          Be the first to launch a campaign.
        </p>
        <Link
          href="/tasks/create"
          className="mt-3 inline-flex min-h-10 items-center justify-center rounded-xl bg-gradient-to-r from-base-blue via-[#3b6cff] to-indigo-600 px-5 text-[0.72rem] font-bold uppercase tracking-[0.14em] text-white shadow-[0_8px_20px_rgba(0,82,255,0.35)]"
        >
          ✨ CREATE TASK
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <TaskFilters active={section} onChange={setSection} />
      {joinHint ? (
        <p className="text-[0.7rem] text-cyan-100/80" role="status">
          {joinHint}
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {visible.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onJoin={onJoin}
            joining={joiningId === task.id}
            joined={joinedIds.includes(task.id)}
          />
        ))}
      </div>
    </div>
  );
}
