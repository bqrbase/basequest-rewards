"use client";

import AudienceBadge from "@/components/task2earn/AudienceBadge";
import CampaignCountdown from "@/components/task2earn/CampaignCountdown";
import ShareActions from "@/components/task2earn/ShareActions";
import TaskTypeBadge from "@/components/task2earn/TaskTypeBadge";
import { isTask2EarnTestTask } from "@/lib/task2earn/constants";
import {
  formatTokenAmount,
  formatUsdAmount,
  getTaskRequirements,
  parseNumericAmount,
  REQUIREMENT_LABELS,
  TASK_STATUS_BADGE_CLASS,
  TASK_STATUS_LABELS,
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

function actionLine(task: TaskMarketplaceItem): string {
  return getTaskRequirements(task.taskType)
    .flatMap((requirement) =>
      requirement === "share_cast" || requirement === "share_snap"
        ? []
        : [REQUIREMENT_LABELS[requirement]],
    )
    .join(" · ");
}

export default function TaskCard({
  task,
  onJoin,
  joining = false,
  joined = false,
}: TaskCardProps) {
  const estimated = task.estimatedRewardPerUser
    ? formatTokenAmount(task.estimatedRewardPerUser, task.rewardToken)
    : null;
  const poolUsd = parseNumericAmount(task.poolUsdValue);
  const description = task.description.trim();
  const target = targetLine(task);
  const action = actionLine(task);

  return (
    <article className="relative overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(165deg,rgba(16,22,48,0.96),rgba(8,12,28,0.94))] p-3 shadow-[0_12px_28px_rgba(0,0,0,0.32)]">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-10 size-28 rounded-full bg-amber-400/10 blur-3xl"
      />
      <div className="relative flex items-start gap-2.5">
        <span
          aria-hidden
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-base"
        >
          {TASK_TYPE_ICON[task.taskType]}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1">
            <span
              className={`inline-flex rounded-full border px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-wide ${TASK_STATUS_BADGE_CLASS[task.status]}`}
            >
              {TASK_STATUS_LABELS[task.status]}
            </span>
            <TaskTypeBadge taskType={task.taskType} />
            {isTask2EarnTestTask(task) ? (
              <span className="inline-flex rounded-full border border-amber-400/35 bg-amber-500/15 px-1.5 py-0.5 text-[0.55rem] font-bold uppercase text-amber-100">
                Test
              </span>
            ) : null}
          </div>
          <h3 className="mt-1.5 font-sans text-[0.95rem] font-bold leading-snug text-white">
            {task.title}
          </h3>
          {description ? (
            <p className="mt-0.5 line-clamp-2 text-[0.72rem] leading-snug text-white/50">
              {description}
            </p>
          ) : null}
        </div>
      </div>

      <p className="relative mt-2 text-[0.68rem] leading-snug text-white/45">
        Creator {formatWalletAddress(task.creatorWallet)}
        {target ? ` · ${target}` : ""}
      </p>
      {action ? (
        <p className="relative mt-0.5 text-[0.68rem] font-medium text-white/70">
          Do: {action}
        </p>
      ) : null}

      <div className="relative mt-2.5 flex items-end justify-between gap-3 rounded-xl border border-amber-300/20 bg-amber-400/[0.08] px-3 py-2">
        <div>
          <p className="text-[0.58rem] font-bold uppercase tracking-[0.16em] text-amber-200/70">
            Reward pool
          </p>
          <p className="mt-0.5 font-sans text-xl font-bold leading-none tracking-tight text-amber-50">
            {formatTokenAmount(task.poolAmount, task.rewardToken)}
          </p>
          {poolUsd > 0 ? (
            <p className="mt-0.5 text-[0.65rem] text-white/40">
              {formatUsdAmount(poolUsd)}
            </p>
          ) : null}
        </div>
        <div className="text-right">
          <p className="text-[0.58rem] font-bold uppercase tracking-[0.14em] text-white/35">
            Time left
          </p>
          <CampaignCountdown endsAt={task.endsAt} />
          {estimated ? (
            <p className="mt-0.5 text-[0.62rem] text-white/45">
              Est. {estimated}
            </p>
          ) : null}
        </div>
      </div>
      <p className="relative mt-1 text-[0.58rem] font-semibold uppercase tracking-wide text-amber-200/50">
        ESTIMATED · not claimable
      </p>

      <div className="relative mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.68rem] text-white/50">
        <span>
          {task.participantCount}
          {task.maxParticipants ? ` / ${task.maxParticipants}` : ""} joined
        </span>
        <span aria-hidden>·</span>
        <span>{task.verifiedCount} verified</span>
      </div>
      <div className="relative mt-1.5">
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
            className="inline-flex min-h-10 flex-[1.4] items-center justify-center rounded-xl bg-gradient-to-r from-base-blue via-[#3b6cff] to-indigo-600 text-[0.72rem] font-bold uppercase tracking-wide text-white shadow-[0_8px_18px_rgba(0,82,255,0.32)] disabled:opacity-50"
          >
            {joined ? "Joined" : joining ? "Joining…" : "Join"}
          </button>
        ) : (
          <Link
            href={`/tasks/${task.id}`}
            className="inline-flex min-h-10 flex-[1.4] items-center justify-center rounded-xl bg-gradient-to-r from-base-blue via-[#3b6cff] to-indigo-600 text-[0.72rem] font-bold uppercase tracking-wide text-white shadow-[0_8px_18px_rgba(0,82,255,0.32)]"
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
