"use client";

import TaskCard from "@/components/task2earn/TaskCard";
import TaskFilters, {
  MARKETPLACE_SECTION_LABELS,
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
      <div className="grid grid-cols-1 gap-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="min-h-[12rem] animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]"
          />
        ))}
      </div>
    );
  }

  if (tasksQuery.isError) {
    return (
      <p className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">
        {tasksQuery.error instanceof Error
          ? tasksQuery.error.message
          : "Unable to load tasks"}
      </p>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-10 text-center">
        <p className="text-lg font-bold text-white">🎯 No active tasks yet</p>
        <p className="mt-2 text-sm text-white/55">
          Create an off-chain draft to get started. No funds are accepted yet.
        </p>
        <Link
          href="/tasks/create"
          className="mt-4 inline-flex min-h-10 items-center justify-center rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 px-5 text-[0.72rem] font-semibold uppercase tracking-wide text-white"
        >
          Create Task
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Link
          href="/tasks/create"
          className="inline-flex min-h-9 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-500/15 px-3 text-[0.7rem] font-semibold uppercase tracking-wide text-cyan-100"
        >
          Create Task
        </Link>
      </div>
      <TaskFilters active={section} onChange={setSection} />
      {joinHint ? (
        <p className="text-[0.7rem] text-cyan-100/80" role="status">
          {joinHint}
        </p>
      ) : null}
      <section>
        <h2 className="mb-2.5 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-white/45">
          {MARKETPLACE_SECTION_LABELS[section]}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
      </section>
    </div>
  );
}
