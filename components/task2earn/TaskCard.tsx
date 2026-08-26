"use client";

import AudienceBadge from "@/components/task2earn/AudienceBadge";
import CampaignCountdown from "@/components/task2earn/CampaignCountdown";
import ShareActions from "@/components/task2earn/ShareActions";
import { isTask2EarnTestTask } from "@/lib/task2earn/constants";
import {
  formatTokenAmount,
  formatUsdAmount,
  parseNumericAmount,
  TASK_STATUS_BADGE_CLASS,
  TASK_STATUS_LABELS,
  TASK_TYPE_LABELS,
} from "@/lib/task2earn/display";
import type { TaskMarketplaceItem, TaskType } from "@/lib/task2earn/types";
import { formatWalletAddress } from "@/lib/ui-styles";
import Link from "next/link";

const TASK_TYPE_ICON: Record<TaskType, string> = {
  follow: "👤",
  like: "❤️",
  recast: "🔁",
  comment: "💬",
  like_recast: "💫",
  like_recast_comment: "✨",
  bundle: "📦",
  mini_app: "📱",
};

type TaskCardProps = {
  task: TaskMarketplaceItem;
  onJoin?: (taskId: string) => void;
  joining?: boolean;
  joined?: boolean;
};

function targetLine(task: TaskMarketplaceItem): string | null {
  const target = task.taskTarget;
  if (!target) {
    return null;
  }
  if (target.kind === "follow") {
    return `@${target.username}`;
  }
  if (target.kind === "mini_app") {
    return target.name || target.url;
  }
  try {
    const host = new URL(target.url).hostname.replace(/^www\./, "");
    return target.castHash
      ? `${host} · ${target.castHash.slice(0, 10)}…`
      : host;
  } catch {
    return target.url;
  }
}

export default function TaskCard({
  task,
  onJoin,
  joining = false,
  joined = false,
}: TaskCardProps) {
  const poolUsd = parseNumericAmount(task.poolUsdValue);
  const target = targetLine(task);

  return (
    <article className="relative overflow-hidden rounded-2xl border border-violet-400/15 bg-[linear-gradient(180deg,rgba(18,16,42,0.96),rgba(8,12,28,0.96))] p-3 shadow-[0_10px_24px_rgba(0,0,0,0.35)]">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-8 size-24 rounded-full bg-violet-500/20 blur-3xl"
      />
      <div className="relative flex items-start gap-2.5">
        <span
          aria-hidden
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-lg"
        >
          {TASK_TYPE_ICON[task.taskType]}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1">
            <span
              className={`inline-flex rounded-full border px-1.5 py-0.5 text-[0.52rem] font-bold uppercase tracking-wide ${TASK_STATUS_BADGE_CLASS[task.status]}`}
            >
              {TASK_STATUS_LABELS[task.status]}
            </span>
            <span className="text-[0.62rem] font-semibold uppercase tracking-wide text-white/45">
              {TASK_TYPE_LABELS[task.taskType]}
            </span>
            {isTask2EarnTestTask(task) ? (
              <span className="inline-flex rounded-full border border-amber-400/35 bg-amber-500/15 px-1.5 py-0.5 text-[0.52rem] font-bold uppercase text-amber-100">
                Test
              </span>
            ) : null}
          </div>
          <h3 className="mt-1 font-sans text-[0.95rem] font-bold leading-snug text-white">
            {task.title}
          </h3>
          <p className="mt-0.5 truncate text-[0.68rem] text-white/45">
            {target ?? `Creator ${formatWalletAddress(task.creatorWallet)}`}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[0.52rem] font-bold uppercase tracking-[0.14em] text-amber-200/70">
            Reward pool
          </p>
          <p className="mt-0.5 font-sans text-lg font-bold leading-none tracking-tight text-white">
            {formatTokenAmount(task.poolAmount, task.rewardToken)}
          </p>
          {poolUsd > 0 ? (
            <p className="mt-0.5 text-[0.6rem] text-white/40">
              {formatUsdAmount(poolUsd)}
            </p>
          ) : null}
        </div>
      </div>

      <div className="relative mt-2.5 flex items-center justify-between gap-2 text-[0.68rem] text-white/50">
        <span>
          {task.participantCount}
          {task.maxParticipants ? ` / ${task.maxParticipants}` : ""} joined
          {" · "}
          {task.verifiedCount} verified
        </span>
        <CampaignCountdown endsAt={task.endsAt} />
      </div>
      <div className="relative mt-1">
        <AudienceBadge rules={task.targetAudience} compact />
      </div>

      {task.shareCastEnabled || task.shareSnapEnabled ? (
        <div className="relative mt-2">
          <ShareActions
            taskId={task.id}
            title={task.title}
            rewardToken={task.rewardToken}
            poolAmount={task.poolAmount}
            durationDays={task.durationDays}
            shareCastEnabled={task.shareCastEnabled}
            shareSnapEnabled={task.shareSnapEnabled}
            shareCastRewardBqr={task.shareCastRewardBqr}
            shareSnapRewardBqr={task.shareSnapRewardBqr}
            compact
          />
        </div>
      ) : null}

      <div className="relative mt-2.5 flex gap-2">
        {onJoin ? (
          <button
            type="button"
            onClick={() => onJoin(task.id)}
            disabled={joining || joined}
            className="inline-flex min-h-10 flex-[1.5] items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-base-blue text-[0.72rem] font-bold uppercase tracking-wide text-white shadow-[0_8px_18px_rgba(124,58,237,0.38)] disabled:opacity-50"
          >
            {joined ? "Joined" : joining ? "Joining…" : "Join"}
          </button>
        ) : (
          <Link
            href={`/tasks/${task.id}`}
            className="inline-flex min-h-10 flex-[1.5] items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-base-blue text-[0.72rem] font-bold uppercase tracking-wide text-white shadow-[0_8px_18px_rgba(124,58,237,0.38)]"
          >
            Join
          </Link>
        )}
        <Link
          href={`/tasks/${task.id}`}
          className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl border border-white/12 bg-white/[0.05] text-[0.72rem] font-semibold uppercase tracking-wide text-white/85"
        >
          View
        </Link>
      </div>
    </article>
  );
}
