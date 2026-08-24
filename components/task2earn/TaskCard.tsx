"use client";

import AudienceBadge from "@/components/task2earn/AudienceBadge";
import CampaignCountdown from "@/components/task2earn/CampaignCountdown";
import RewardBadge from "@/components/task2earn/RewardBadge";
import ShareActions from "@/components/task2earn/ShareActions";
import TaskTypeBadge from "@/components/task2earn/TaskTypeBadge";
import {
  formatTokenAmount,
  TASK_STATUS_BADGE_CLASS,
  TASK_STATUS_LABELS,
} from "@/lib/task2earn/display";
import { isTask2EarnTestTask } from "@/lib/task2earn/constants";
import type { TaskMarketplaceItem } from "@/lib/task2earn/types";
import { formatWalletAddress } from "@/lib/ui-styles";
import Link from "next/link";

type TaskCardProps = {
  task: TaskMarketplaceItem;
  onJoin?: (taskId: string) => void;
  joining?: boolean;
  joined?: boolean;
};

export default function TaskCard({
  task,
  onJoin,
  joining = false,
  joined = false,
}: TaskCardProps) {
  const estimated = task.estimatedRewardPerUser
    ? formatTokenAmount(task.estimatedRewardPerUser, task.rewardToken)
    : "—";

  return (
    <article className="relative overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(160deg,rgba(18,10,36,0.92),rgba(8,16,36,0.88))] p-3.5 shadow-[0_12px_32px_rgba(0,0,0,0.35)]">
      <div className="flex flex-wrap items-center gap-1.5">
        <TaskTypeBadge taskType={task.taskType} />
        <RewardBadge token={task.rewardToken} />
        <span
          className={`inline-flex rounded-full border px-2 py-0.5 text-[0.58rem] font-bold uppercase ${TASK_STATUS_BADGE_CLASS[task.status]}`}
        >
          {TASK_STATUS_LABELS[task.status]}
        </span>
        {isTask2EarnTestTask(task) ? (
          <span className="inline-flex rounded-full border border-amber-400/35 bg-amber-500/15 px-2 py-0.5 text-[0.58rem] font-bold uppercase text-amber-100">
            Test
          </span>
        ) : null}
      </div>

      <h3 className="mt-2.5 font-sans text-base font-bold leading-snug text-white">
        {task.title}
      </h3>
      <p className="mt-1 text-[0.7rem] text-white/50">
        Creator {formatWalletAddress(task.creatorWallet)}
      </p>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-[0.72rem]">
        <div>
          <dt className="text-white/40">Total pool</dt>
          <dd className="font-semibold text-amber-100">
            {formatTokenAmount(task.poolAmount, task.rewardToken)}
          </dd>
        </div>
        <div>
          <dt className="text-white/40">Est. per user</dt>
          <dd className="font-semibold text-white">{estimated}</dd>
        </div>
        <div>
          <dt className="text-white/40">Participants</dt>
          <dd className="font-semibold text-white">
            {task.participantCount}
            {task.maxParticipants ? ` / ${task.maxParticipants}` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-white/40">Ends</dt>
          <dd>
            <CampaignCountdown endsAt={task.endsAt} />
          </dd>
        </div>
      </dl>
      <p className="mt-1 text-[0.62rem] font-semibold uppercase tracking-wide text-amber-200/60">
        ESTIMATED · not claimable
      </p>

      <div className="mt-3">
        <AudienceBadge rules={task.targetAudience} compact />
      </div>

      {(task.shareCastEnabled || task.shareSnapEnabled) ? (
        <div className="mt-3">
          <ShareActions
            taskId={task.id}
            title={task.title}
            shareCastEnabled={task.shareCastEnabled}
            shareSnapEnabled={task.shareSnapEnabled}
            shareCastRewardBqr={task.shareCastRewardBqr}
            shareSnapRewardBqr={task.shareSnapRewardBqr}
            compact
          />
        </div>
      ) : null}

      <div className="mt-3 flex gap-2">
        <Link
          href={`/tasks/${task.id}`}
          className="inline-flex min-h-10 flex-1 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-[0.72rem] font-semibold uppercase tracking-wide text-white"
        >
          View Task
        </Link>
        {onJoin ? (
          <button
            type="button"
            onClick={() => onJoin(task.id)}
            disabled={joining || joined}
            className="inline-flex min-h-10 flex-1 items-center justify-center rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 text-[0.72rem] font-semibold uppercase tracking-wide text-white disabled:opacity-50"
          >
            {joined ? "Joined" : joining ? "Joining…" : "Join"}
          </button>
        ) : (
          <Link
            href={`/tasks/${task.id}`}
            className="inline-flex min-h-10 flex-1 items-center justify-center rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 text-[0.72rem] font-semibold uppercase tracking-wide text-white"
          >
            Join
          </Link>
        )}
      </div>
    </article>
  );
}
