"use client";

import ConnectWalletButton from "@/components/ConnectWalletButton";
import AudienceStep from "@/components/task2earn/create/AudienceStep";
import DetailsStep from "@/components/task2earn/create/DetailsStep";
import ReviewStep from "@/components/task2earn/create/ReviewStep";
import RewardStep from "@/components/task2earn/create/RewardStep";
import TargetStep from "@/components/task2earn/create/TargetStep";
import TypeStep from "@/components/task2earn/create/TypeStep";
import CreateTaskStepper, {
  CREATE_TASK_STEPS,
} from "@/components/task2earn/CreateTaskStepper";
import ShareActions from "@/components/task2earn/ShareActions";
import { createDraftTaskRequest, fetchTaskPrices } from "@/lib/task2earn/client";
import { getCampaignRules } from "@/lib/task2earn/constants";
import {
  isPublicHttpsUrl,
  isValidFarcasterUsername,
  needsCastTarget,
  needsFollowTarget,
  needsMiniAppTarget,
  normalizeFarcasterUsername,
  parseFarcasterCastUrl,
} from "@/lib/task2earn/target";
import {
  parsePoolAmount,
  sanitizeAudience,
  validateDescription,
  validateMaxParticipants,
  validateTitle,
} from "@/lib/task2earn/validate";
import type {
  CampaignDuration,
  RewardToken,
  Task2EarnTask,
  TaskTarget,
  TaskType,
} from "@/lib/task2earn/types";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useAccount } from "wagmi";

const GLASS =
  "rounded-2xl border border-white/10 bg-[linear-gradient(160deg,rgba(18,10,36,0.92),rgba(8,16,36,0.88))] p-4 shadow-[0_12px_32px_rgba(0,0,0,0.35)]";

function previewTarget(params: {
  taskType: TaskType;
  castUrl: string;
  followUsername: string;
  miniAppUrl: string;
  miniAppName: string;
}): TaskTarget | null {
  if (needsFollowTarget(params.taskType)) {
    if (!isValidFarcasterUsername(params.followUsername)) {
      return null;
    }
    return {
      kind: "follow",
      username: normalizeFarcasterUsername(params.followUsername),
      fid: null,
      displayName: null,
    };
  }
  if (needsMiniAppTarget(params.taskType)) {
    const url = isPublicHttpsUrl(params.miniAppUrl);
    if (!url) {
      return null;
    }
    return {
      kind: "mini_app",
      name: params.miniAppName.trim() || url.hostname,
      url: url.toString(),
      appId: null,
      metadata: {},
    };
  }
  return parseFarcasterCastUrl(params.castUrl);
}

export default function CreateTaskWizard() {
  const { address, status } = useAccount();
  const wallet = status === "connected" && address ? address : null;
  const [step, setStep] = useState(0);
  const [taskType, setTaskType] = useState<TaskType | null>(null);
  const [castUrl, setCastUrl] = useState("");
  const [followQuery, setFollowQuery] = useState("");
  const [followUsername, setFollowUsername] = useState("");
  const [miniAppQuery, setMiniAppQuery] = useState("");
  const [miniAppUrl, setMiniAppUrl] = useState("");
  const [miniAppName, setMiniAppName] = useState("");
  const [miniManual, setMiniManual] = useState(false);
  const [minFollowers, setMinFollowers] = useState<number | null>(null);
  const [minNeynar, setMinNeynar] = useState(0);
  const [minAge, setMinAge] = useState<number | null>(null);
  const [nonSpam, setNonSpam] = useState(false);
  const [photoRequired, setPhotoRequired] = useState(false);
  const [rewardToken, setRewardToken] = useState<RewardToken>("BQR");
  const [poolAmount, setPoolAmount] = useState("");
  const [durationDays, setDurationDays] = useState<CampaignDuration>(1);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<Task2EarnTask | null>(null);
  const [previewStartedAt] = useState(() => Date.now());

  const pricesQuery = useQuery({
    queryKey: ["t2e-prices"],
    queryFn: fetchTaskPrices,
    staleTime: 60_000,
    retry: 1,
  });
  const endsAt = useMemo(
    () => new Date(previewStartedAt + durationDays * 24 * 60 * 60 * 1000),
    [durationDays, previewStartedAt],
  );

  const audience = useMemo(
    () =>
      sanitizeAudience({
        minimum_followers: minFollowers,
        minimum_neynar_score: minNeynar,
        minimum_account_age_days: minAge,
        non_spam_only: nonSpam,
        profile_photo_required: photoRequired,
      }),
    [minAge, minFollowers, minNeynar, nonSpam, photoRequired],
  );

  const target = taskType
    ? previewTarget({
        taskType,
        castUrl,
        followUsername: followUsername || followQuery,
        miniAppUrl,
        miniAppName,
      })
    : null;

  const stepLabels = CREATE_TASK_STEPS.map((label, index) => {
    if (index !== 1 || !taskType) {
      return label;
    }
    if (needsFollowTarget(taskType)) {
      return "Account";
    }
    if (needsMiniAppTarget(taskType)) {
      return "Mini App";
    }
    return "Cast";
  });

  function validateStep(current: number): string | null {
    if (current === 0) {
      return taskType ? null : "Select a task type";
    }
    if (current === 1 && taskType) {
      if (needsFollowTarget(taskType)) {
        const username = followUsername || followQuery;
        if (!isValidFarcasterUsername(username)) {
          return "Enter or select a Farcaster account";
        }
        return null;
      }
      if (needsMiniAppTarget(taskType)) {
        return isPublicHttpsUrl(miniAppUrl)
          ? null
          : "Enter or select a Mini App URL";
      }
      if (needsCastTarget(taskType)) {
        return parseFarcasterCastUrl(castUrl)
          ? null
          : "Enter a valid Farcaster cast URL";
      }
    }
    if (current === 3) {
      const amount = parsePoolAmount(poolAmount);
      if (amount === null) {
        return "Enter a pool amount greater than 0";
      }
      const rate = pricesQuery.data?.[rewardToken] ?? null;
      if (rate !== null) {
        const poolUsd = amount * rate;
        const min = getCampaignRules(durationDays).minPoolUsd;
        if (poolUsd < min) {
          return `Pool must be at least $${min.toFixed(2)} USD for this duration`;
        }
      }
      return null;
    }
    if (current === 4) {
      const titleError = validateTitle(title);
      if (titleError) {
        return titleError;
      }
      const descriptionError = validateDescription(description);
      if (descriptionError) {
        return descriptionError;
      }
      const maxParsed = validateMaxParticipants(maxParticipants);
      if (maxParsed && typeof maxParsed === "object") {
        return maxParsed.error;
      }
      return null;
    }
    return null;
  }

  function goNext() {
    if (step === 1 && taskType && needsFollowTarget(taskType) && !followUsername) {
      setFollowUsername(normalizeFarcasterUsername(followQuery));
    }
    const message = validateStep(step);
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    setStep((current) => Math.min(current + 1, CREATE_TASK_STEPS.length - 1));
  }

  async function onCreateDraft() {
    if (!taskType) {
      setError("Select a task type");
      return;
    }
    if (!wallet) {
      setError("Connect your wallet to create a draft");
      return;
    }
    const lastError =
      validateStep(0) ??
      validateStep(1) ??
      validateStep(3) ??
      validateStep(4);
    if (lastError) {
      setError(lastError);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const maxParsed = validateMaxParticipants(maxParticipants);
      const result = await createDraftTaskRequest({
        wallet,
        taskType,
        title,
        description,
        rewardToken,
        poolAmount,
        durationDays,
        maxParticipants:
          maxParsed && typeof maxParsed === "object" ? undefined : maxParsed,
        audience,
        target: needsFollowTarget(taskType)
          ? {
              kind: "follow",
              username: normalizeFarcasterUsername(
                followUsername || followQuery,
              ),
            }
          : needsMiniAppTarget(taskType)
            ? { kind: "mini_app", url: miniAppUrl, name: miniAppName }
            : { kind: "cast", url: castUrl },
      });
      setCreated(result.task);
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : "Unable to create draft",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    return (
      <section className={GLASS}>
        <p className="text-sm font-semibold text-emerald-100">Draft created</p>
        <h2 className="mt-1 font-sans text-xl font-bold text-white">{created.title}</h2>
        <p className="mt-2 text-sm text-white/60">
          Off-chain draft only. Not funded yet. No tokens were transferred.
        </p>
        <div className="mt-4">
          <ShareActions taskId={created.id} title={created.title} />
        </div>
        <div className="mt-4 flex gap-2">
          <Link
            href={`/tasks/${created.id}`}
            className="inline-flex min-h-10 flex-1 items-center justify-center rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 text-[0.72rem] font-semibold uppercase tracking-wide text-white"
          >
            View draft
          </Link>
          <Link
            href="/tasks"
            className="inline-flex min-h-10 flex-1 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-[0.72rem] font-semibold uppercase tracking-wide text-white"
          >
            Marketplace
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <CreateTaskStepper step={step} labels={stepLabels} />
      <section className={GLASS}>
        <h2 className="font-sans text-lg font-bold text-white">
          {stepLabels[step]}
        </h2>
        <div className="mt-4">
          {step === 0 ? (
            <TypeStep value={taskType} onChange={setTaskType} />
          ) : null}
          {step === 1 && taskType ? (
            <TargetStep
              taskType={taskType}
              castUrl={castUrl}
              onCastUrl={setCastUrl}
              followQuery={followQuery}
              onFollowQuery={setFollowQuery}
              followUsername={followUsername}
              onFollowUsername={setFollowUsername}
              miniAppQuery={miniAppQuery}
              onMiniAppQuery={setMiniAppQuery}
              miniAppUrl={miniAppUrl}
              onMiniAppUrl={setMiniAppUrl}
              miniAppName={miniAppName}
              onMiniAppName={setMiniAppName}
              miniManual={miniManual}
              onMiniManual={setMiniManual}
            />
          ) : null}
          {step === 2 ? (
            <AudienceStep
              minFollowers={minFollowers}
              onMinFollowers={setMinFollowers}
              minNeynar={minNeynar}
              onMinNeynar={setMinNeynar}
              minAge={minAge}
              onMinAge={setMinAge}
              nonSpam={nonSpam}
              onNonSpam={setNonSpam}
              photoRequired={photoRequired}
              onPhotoRequired={setPhotoRequired}
            />
          ) : null}
          {step === 3 ? (
            <RewardStep
              rewardToken={rewardToken}
              onRewardToken={setRewardToken}
              poolAmount={poolAmount}
              onPoolAmount={setPoolAmount}
              durationDays={durationDays}
              onDurationDays={setDurationDays}
              prices={pricesQuery.data}
              endsAt={endsAt}
            />
          ) : null}
          {step === 4 ? (
            <DetailsStep
              title={title}
              onTitle={setTitle}
              description={description}
              onDescription={setDescription}
              maxParticipants={maxParticipants}
              onMaxParticipants={setMaxParticipants}
            />
          ) : null}
          {step === 5 && taskType ? (
            <ReviewStep
              taskType={taskType}
              target={target}
              audience={audience}
              rewardToken={rewardToken}
              poolAmount={poolAmount}
              durationDays={durationDays}
              title={title}
              prices={pricesQuery.data}
              endsAt={endsAt}
            />
          ) : null}
        </div>

        {error ? (
          <p className="mt-3 text-sm text-rose-200" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex gap-2">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setStep((current) => Math.max(0, current - 1));
              }}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-[0.75rem] font-semibold uppercase tracking-wide text-white"
            >
              Back
            </button>
          ) : null}
          {step < CREATE_TASK_STEPS.length - 1 ? (
            <button
              type="button"
              onClick={goNext}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 text-[0.75rem] font-semibold uppercase tracking-wide text-white"
            >
              Next
            </button>
          ) : wallet ? (
            <button
              type="button"
              disabled={submitting}
              onClick={() => void onCreateDraft()}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 text-[0.75rem] font-semibold uppercase tracking-wide text-white disabled:opacity-50"
            >
              {submitting ? "Creating…" : "Create Draft"}
            </button>
          ) : (
            <div className="flex-1">
              <ConnectWalletButton
                buttonClassName="flex min-h-11 w-full items-center justify-center rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 px-4 text-sm font-semibold text-white"
                disabledClassName="flex min-h-11 w-full items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-white/45"
              />
              <p className="mt-2 text-center text-[0.7rem] text-white/45">
                Connect to create an off-chain draft. No funds are accepted.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
