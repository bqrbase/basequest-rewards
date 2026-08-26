"use client";

import ConnectWalletButton from "@/components/ConnectWalletButton";
import AudienceBadge from "@/components/task2earn/AudienceBadge";
import CampaignCountdown from "@/components/task2earn/CampaignCountdown";
import PoolSplitCard from "@/components/task2earn/PoolSplitCard";
import RewardBadge from "@/components/task2earn/RewardBadge";
import ShareActions from "@/components/task2earn/ShareActions";
import TaskRequirements from "@/components/task2earn/TaskRequirements";
import TaskTypeBadge from "@/components/task2earn/TaskTypeBadge";
import VerificationPanel from "@/components/task2earn/VerificationPanel";
import {
  fetchTaskDetail,
  joinTaskRequest,
  verifyTaskRequest,
  type TaskVerificationCheck,
} from "@/lib/task2earn/client";
import {
  DURATION_LABELS,
  formatTokenAmount,
  TASK_STATUS_BADGE_CLASS,
  TASK_STATUS_LABELS,
} from "@/lib/task2earn/display";
import { formatTaskTargetSummary } from "@/lib/task2earn/target";
import { isTask2EarnTestTask } from "@/lib/task2earn/constants";
import { mapJoinError } from "@/lib/task2earn/verification-ui";
import { formatWalletAddress } from "@/lib/ui-styles";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useCallback, useState } from "react";
import { useAccount } from "wagmi";

type TaskDetailsProps = {
  taskId: string;
};

function formatUtcTimestamp(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) {
    return "—";
  }
  return `${new Date(ms).toISOString().replace("T", " ").slice(0, 16)} UTC`;
}

export default function TaskDetails({ taskId }: TaskDetailsProps) {
  const { address, status } = useAccount();
  const wallet = status === "connected" && address ? address : null;
  const [joining, setJoining] = useState(false);
  const [joinMessage, setJoinMessage] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyAttempted, setVerifyAttempted] = useState(false);
  const [verifyEligible, setVerifyEligible] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifyChecks, setVerifyChecks] = useState<TaskVerificationCheck[] | null>(
    null,
  );

  const taskQuery = useQuery({
    queryKey: ["t2e-task", taskId, wallet?.toLowerCase() ?? null],
    queryFn: () => fetchTaskDetail(taskId, wallet ?? undefined),
    staleTime: 10_000,
    retry: 1,
  });

  const onJoin = useCallback(async () => {
    if (!wallet) {
      setJoinMessage("Connect your wallet to join.");
      return;
    }
    setJoining(true);
    setJoinMessage(null);
    try {
      const result = await joinTaskRequest(taskId, wallet);
      setJoinMessage(
        result.alreadyJoined
          ? "Already joined. No rewards transferred."
          : "Joined. No rewards transferred.",
      );
      await taskQuery.refetch();
    } catch (joinError) {
      setJoinMessage(
        joinError instanceof Error
          ? mapJoinError(joinError.message)
          : "Join failed",
      );
    } finally {
      setJoining(false);
    }
  }, [taskId, taskQuery, wallet]);

  const onVerify = useCallback(async () => {
    if (!wallet) {
      setVerifyAttempted(true);
      setVerifyEligible(false);
      setVerifyError("Connect a valid wallet to verify.");
      setVerifyChecks([]);
      return;
    }
    setVerifying(true);
    setVerifyError(null);
    try {
      const result = await verifyTaskRequest(taskId, wallet);
      setVerifyAttempted(true);
      setVerifyChecks(result.checks);
      if (result.error) {
        setVerifyEligible(false);
        setVerifyError(result.error);
      } else {
        setVerifyEligible(result.eligible);
        setVerifyError(null);
      }
      await taskQuery.refetch();
    } catch {
      setVerifyAttempted(true);
      setVerifyEligible(false);
      setVerifyChecks([]);
      setVerifyError("Verification failed. The task was not marked verified.");
    } finally {
      setVerifying(false);
    }
  }, [taskId, taskQuery, wallet]);

  if (taskQuery.isPending) {
    return (
      <div className="min-h-[18rem] animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" />
    );
  }

  if (taskQuery.isError || !taskQuery.data) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center">
        <p className="font-semibold text-white">Task not found</p>
        <Link href="/tasks/browse" className="mt-3 inline-block text-sm text-cyan-200">
          Back to marketplace
        </Link>
      </div>
    );
  }

  const task = taskQuery.data;
  const ended = task.status === "ended" || task.status === "cancelled";
  const alreadyJoined = Boolean(task.viewerParticipant);
  const joinDisabled = joining || alreadyJoined || !task.joinable || ended;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/tasks/browse" className="text-[0.75rem] font-medium text-cyan-200/80">
        ← Marketplace
      </Link>

      <header className="rounded-2xl border border-white/10 bg-[linear-gradient(160deg,rgba(18,10,36,0.94),rgba(8,18,40,0.9))] p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <TaskTypeBadge taskType={task.taskType} />
          <RewardBadge token={task.rewardToken} />
          <span
            className={`inline-flex rounded-full border px-2 py-0.5 text-[0.58rem] font-bold uppercase ${TASK_STATUS_BADGE_CLASS[task.status]}`}
          >
            {TASK_STATUS_LABELS[task.status]}
          </span>
          {task.viewerParticipant ? (
            <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[0.58rem] font-bold uppercase text-white/80">
              {task.viewerParticipant.status}
            </span>
          ) : null}
        </div>
        <h1 className="mt-3 font-sans text-2xl font-bold leading-tight text-white">
          {task.title}
        </h1>
        {isTask2EarnTestTask(task) ? (
          <p className="mt-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-[0.75rem] leading-relaxed text-amber-100">
            Off-chain verification test. Unfunded display-only pool. No escrow,
            claims, or payouts.
          </p>
        ) : null}
        <p className="mt-1.5 text-sm text-white/50">
          Creator {formatWalletAddress(task.creatorWallet)}
        </p>
        {task.description ? (
          <p className="mt-3 text-sm leading-relaxed text-white/70">
            {task.description}
          </p>
        ) : null}
        <p className="mt-4 text-sm text-white/80">
          Total pool{" "}
          <span className="font-semibold text-amber-100">
            {formatTokenAmount(task.poolAmount, task.rewardToken)}
          </span>
        </p>
        <p className="text-[0.7rem] text-white/40">
          {task.participantCount} participant
          {task.participantCount === 1 ? "" : "s"} · {task.verifiedCount} verified
        </p>
      </header>

      <PoolSplitCard
        poolAmount={task.poolAmount}
        rewardToken={task.rewardToken}
        verifiedCount={task.verifiedCount}
        estimatedRewardPerUser={task.estimatedRewardPerUser}
        campaignEnded={ended}
      />

      <TaskRequirements taskType={task.taskType} />

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-white/45">
          Target
        </p>
        <p className="mt-2 break-all text-sm text-white/80">
          {formatTaskTargetSummary(task.taskTarget)}
        </p>
      </section>

      <section>
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-white/45">
          Target audience
        </p>
        <div className="mt-2">
          <AudienceBadge rules={task.targetAudience} />
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-white/45">
          Campaign
        </p>
        <p className="mt-2 text-sm text-white">
          {DURATION_LABELS[task.durationDays]}
        </p>
        <p className="mt-1 text-sm text-white/60">
          Ends {formatUtcTimestamp(task.endsAt)}
        </p>
        <div className="mt-1">
          <CampaignCountdown endsAt={task.endsAt} />
        </div>
        <p className="mt-2 text-[0.7rem] text-white/45">
          Status: {TASK_STATUS_LABELS[task.status]}
        </p>
      </section>

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
      />

      {!wallet ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-white/60">Connect your wallet to join.</p>
          <ConnectWalletButton
            buttonClassName="flex min-h-11 items-center justify-center rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 px-4 text-sm font-semibold text-white"
            disabledClassName="flex min-h-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-white/45"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void onJoin()}
          disabled={joinDisabled}
          className="min-h-12 rounded-full bg-gradient-to-r from-violet-600 via-indigo-500 to-cyan-500 text-sm font-bold uppercase tracking-wide text-white shadow-[0_8px_24px_rgba(99,102,241,0.35)] disabled:opacity-50"
        >
          {alreadyJoined
            ? "Joined"
            : joining
              ? "Joining…"
              : task.status === "draft"
                ? "Draft — not joinable"
                : ended
                ? "Campaign ended"
                : "Join Task"}
        </button>
      )}
      {joinMessage ? (
        <p className="text-sm text-cyan-100/80" role="status">
          {joinMessage}
        </p>
      ) : null}

      <VerificationPanel
        taskType={task.taskType}
        audience={task.targetAudience}
        participantStatus={task.viewerParticipant?.status ?? null}
        walletConnected={Boolean(wallet)}
        joined={alreadyJoined}
        verifying={verifying}
        attempted={verifyAttempted}
        eligible={verifyEligible}
        error={verifyError}
        checks={verifyChecks}
        onVerify={() => void onVerify()}
      />
    </div>
  );
}
