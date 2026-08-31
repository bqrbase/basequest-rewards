"use client";

import TaskCard from "@/components/task2earn/TaskCard";
import TaskFilters, {
  type MarketplaceStatusFilter,
} from "@/components/task2earn/TaskFilters";
import { MarketplaceSubNav } from "@/components/task2earn/TaskNav";
import { fetchMarketplaceTasks, joinTaskRequest } from "@/lib/task2earn/client";
import { isJoinableStatus, joinedTaskSection } from "@/lib/task2earn/display";
import type { TaskMarketplaceItem } from "@/lib/task2earn/types";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useCallback, useState } from "react";
import { useAccount } from "wagmi";

type TaskMarketplaceProps = {
  scope?: "marketplace" | "joined";
};

function marketplaceStatus(
  task: TaskMarketplaceItem,
): MarketplaceStatusFilter {
  if (isJoinableStatus(task.status, task.endsAt)) {
    return "ongoing";
  }
  if (task.verifiedCount > 0) {
    return "completed";
  }
  return "ended";
}

function filterTasks(
  tasks: TaskMarketplaceItem[],
  status: MarketplaceStatusFilter,
  scope: "marketplace" | "joined",
): TaskMarketplaceItem[] {
  return tasks.filter((task) =>
    scope === "joined"
      ? joinedTaskSection(task) === status
      : marketplaceStatus(task) === status,
  );
}

function CreateTaskCta() {
  return (
    <Link
      href="/tasks/create"
      className="inline-flex min-h-12 w-full items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-base-blue text-[0.82rem] font-bold uppercase tracking-[0.14em] text-white shadow-[0_10px_28px_rgba(124,58,237,0.45),0_0_24px_rgba(0,82,255,0.28)] ring-1 ring-violet-200/25 transition-all duration-150 hover:-translate-y-px hover:shadow-[0_14px_32px_rgba(124,58,237,0.55)] active:translate-y-px active:scale-[0.99]"
    >
      ✨ CREATE TASK
    </Link>
  );
}

function EmptyState({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-center">
      <p className="text-xl leading-none" aria-hidden>
        🎯
      </p>
      <p className="mt-1.5 text-sm font-bold text-white">{title}</p>
      <p className="mt-0.5 text-[0.75rem] text-white/50">{subtitle}</p>
      <Link
        href="/tasks/create"
        className="mt-2.5 inline-flex min-h-9 items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 to-base-blue px-4 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-white shadow-[0_8px_18px_rgba(124,58,237,0.35)]"
      >
        CREATE TASK
      </Link>
    </div>
  );
}

export default function TaskMarketplace({
  scope = "marketplace",
}: TaskMarketplaceProps) {
  const { address, status } = useAccount();
  const wallet = status === "connected" && address ? address : null;
  const [section, setSection] = useState<MarketplaceStatusFilter>("ongoing");
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [joinedIds, setJoinedIds] = useState<string[]>([]);
  const [joinHint, setJoinHint] = useState<string | null>(null);
  const joinedScope = scope === "joined";

  const tasksQuery = useQuery({
    queryKey: joinedScope ? ["t2e-joined-tasks", wallet] : ["t2e-tasks"],
    queryFn: () =>
      joinedScope && wallet
        ? fetchMarketplaceTasks({ scope: "joined", wallet })
        : fetchMarketplaceTasks(),
    enabled: joinedScope ? Boolean(wallet) : true,
    staleTime: 15_000,
    retry: 1,
  });

  const tasks = tasksQuery.data ?? [];
  const visible = filterTasks(tasks, section, scope);

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

  let body;
  if (joinedScope && !wallet) {
    body = (
      <EmptyState
        title="Connect your wallet"
        subtitle="Joined campaigns for this wallet show up here."
      />
    );
  } else if (tasksQuery.isPending) {
    body = (
      <div className="grid grid-cols-1 gap-2">
        {Array.from({ length: 2 }, (_, index) => (
          <div
            key={index}
            className="min-h-[7.5rem] animate-pulse rounded-2xl border border-white/8 bg-white/[0.04]"
          />
        ))}
      </div>
    );
  } else if (tasksQuery.isError) {
    body = (
      <p className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-3 text-sm text-rose-100">
        {tasksQuery.error instanceof Error
          ? tasksQuery.error.message
          : "Unable to load tasks"}
      </p>
    );
  } else if (tasks.length === 0 || visible.length === 0) {
    body = (
      <EmptyState
        title={
          joinedScope
            ? tasks.length === 0
              ? "You haven't joined any tasks yet"
              : section === "ongoing"
                ? "No ongoing tasks you've joined"
                : section === "completed"
                  ? "No completed tasks yet"
                  : "No ended tasks yet"
            : section === "ongoing" || tasks.length === 0
              ? "No live tasks yet"
              : section === "completed"
                ? "No completed tasks yet"
                : "No ended tasks yet"
        }
        subtitle={
          joinedScope
            ? tasks.length === 0
              ? "Join a live campaign from Tasks."
              : "Check Ongoing for campaigns still in progress."
            : section === "ongoing" || tasks.length === 0
              ? "Be the first to launch a campaign."
              : "Check Ongoing for live campaigns."
        }
      />
    );
  } else {
    body = (
      <div className="grid grid-cols-1 gap-2">
        {visible.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onJoin={onJoin}
            joining={joiningId === task.id}
            joined={
              joinedScope ||
              joinedIds.includes(task.id) ||
              Boolean(task.viewerParticipantStatus)
            }
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <CreateTaskCta />
      <MarketplaceSubNav />
      <TaskFilters active={section} onChange={setSection} />
      {joinHint ? (
        <p className="text-[0.7rem] text-cyan-100/80" role="status">
          {joinHint}
        </p>
      ) : null}
      {body}
    </div>
  );
}
