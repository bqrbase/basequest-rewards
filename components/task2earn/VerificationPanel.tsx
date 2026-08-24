"use client";

import type { TaskVerificationCheck } from "@/lib/task2earn/client";
import {
  mapVerificationRows,
  participantStatusLabel,
  resolveVerifyHeadline,
} from "@/lib/task2earn/verification-ui";
import type {
  AudienceRules,
  ParticipantStatus,
  TaskType,
} from "@/lib/task2earn/types";

type VerificationPanelProps = {
  taskType: TaskType;
  audience: AudienceRules;
  participantStatus: ParticipantStatus | null;
  walletConnected: boolean;
  joined: boolean;
  verifying: boolean;
  attempted: boolean;
  eligible: boolean;
  error: string | null;
  checks: TaskVerificationCheck[] | null;
  onVerify: () => void;
};

const HEADLINE_CLASS = {
  idle: "text-white/70",
  pending: "text-cyan-100",
  success: "text-emerald-100",
  failure: "text-rose-100",
  unavailable: "text-amber-100",
} as const;

export default function VerificationPanel({
  taskType,
  audience,
  participantStatus,
  walletConnected,
  joined,
  verifying,
  attempted,
  eligible,
  error,
  checks,
  onVerify,
}: VerificationPanelProps) {
  const rows = mapVerificationRows({
    taskType,
    audience,
    checks,
  });
  const headline = resolveVerifyHeadline({
    taskType,
    verifying,
    attempted,
    eligible,
    error,
  });
  const serverVerified = participantStatus === "verified";
  const showVerify = joined && walletConnected && taskType !== "mini_app";
  const verifyLabel = attempted ? "Verify Again" : "Verify Task";

  return (
    <section className="rounded-2xl border border-white/10 bg-[linear-gradient(160deg,rgba(18,10,36,0.94),rgba(8,18,40,0.9))] p-4">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-white/45">
        Verification
      </p>
      {participantStatus ? (
        <p className="mt-2 text-[0.7rem] uppercase tracking-wide text-white/50">
          Status:{" "}
          <span className="font-semibold text-white">
            {participantStatusLabel(participantStatus)}
          </span>
        </p>
      ) : null}

      <p className={`mt-3 text-base font-semibold ${HEADLINE_CLASS[headline.tone]}`}>
        {headline.title}
      </p>
      {headline.detail ? (
        <p className="mt-1 text-sm leading-relaxed text-white/55">{headline.detail}</p>
      ) : null}

      <ul className="mt-4 flex flex-col gap-2">
        {rows.map((row) => (
          <li
            key={row.slot}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-white/90">{row.label}</span>
              <span className="text-[0.75rem] font-semibold text-white/80">
                {row.symbol ? `${row.symbol} ` : ""}
                {row.statusLabel}
              </span>
            </div>
            {row.reason ? (
              <p className="mt-1 text-[0.7rem] leading-relaxed text-white/50">
                {row.reason}
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      {serverVerified ? (
        <div className="mt-4 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-3">
          <p className="text-sm font-semibold text-emerald-100">Verified participant</p>
          <p className="mt-1 text-[0.75rem] leading-relaxed text-white/55">
            Reward will be calculated after the campaign ends.
          </p>
        </div>
      ) : null}

      {!walletConnected ? (
        <p className="mt-4 text-sm text-white/55">Connect your wallet to verify.</p>
      ) : null}
      {walletConnected && !joined ? (
        <p className="mt-4 text-sm text-white/55">Join this task before verifying.</p>
      ) : null}

      {showVerify ? (
        <button
          type="button"
          onClick={onVerify}
          disabled={verifying}
          className="mt-4 min-h-12 w-full rounded-full bg-gradient-to-r from-[#0052FF] via-indigo-500 to-cyan-500 text-sm font-bold uppercase tracking-wide text-white shadow-[0_8px_24px_rgba(0,82,255,0.35)] disabled:opacity-50"
        >
          {verifying ? "Verifying..." : verifyLabel}
        </button>
      ) : null}
    </section>
  );
}
