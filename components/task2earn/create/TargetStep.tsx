"use client";

import {
  inspectMiniAppRequest,
  searchFarcasterUsersRequest,
  searchMiniAppsRequest,
  type FarcasterUserOption,
} from "@/lib/task2earn/client";
import { parseFarcasterCastUrl } from "@/lib/task2earn/target";
import type { MiniAppTaskTarget, TaskType } from "@/lib/task2earn/types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

const inputClass =
  "w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white placeholder:text-white/35 outline-none focus:border-cyan-400/40";

type TargetStepProps = {
  taskType: TaskType;
  castUrl: string;
  onCastUrl: (value: string) => void;
  followQuery: string;
  onFollowQuery: (value: string) => void;
  followUsername: string;
  onFollowUsername: (value: string) => void;
  miniAppQuery: string;
  onMiniAppQuery: (value: string) => void;
  miniAppUrl: string;
  onMiniAppUrl: (value: string) => void;
  miniAppName: string;
  onMiniAppName: (value: string) => void;
  miniManual: boolean;
  onMiniManual: (value: boolean) => void;
};

export default function TargetStep({
  taskType,
  castUrl,
  onCastUrl,
  followQuery,
  onFollowQuery,
  followUsername,
  onFollowUsername,
  miniAppQuery,
  onMiniAppQuery,
  miniAppUrl,
  onMiniAppUrl,
  miniAppName,
  onMiniAppName,
  miniManual,
  onMiniManual,
}: TargetStepProps) {
  const [inspectMessage, setInspectMessage] = useState<string | null>(null);
  const [inspecting, setInspecting] = useState(false);

  const usersQuery = useQuery({
    queryKey: ["t2e-user-search", followQuery],
    queryFn: () => searchFarcasterUsersRequest(followQuery),
    enabled: taskType === "follow" && followQuery.trim().length >= 2,
    staleTime: 30_000,
  });

  const appsQuery = useQuery({
    queryKey: ["t2e-miniapp-search", miniAppQuery],
    queryFn: () => searchMiniAppsRequest(miniAppQuery),
    enabled: taskType === "mini_app" && !miniManual && miniAppQuery.trim().length >= 2,
    staleTime: 30_000,
  });

  if (taskType === "follow") {
    return (
      <div className="flex flex-col gap-3">
        <label className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-white/45">
          Farcaster account to follow
        </label>
        <input
          className={inputClass}
          value={followQuery}
          onChange={(event) => onFollowQuery(event.target.value)}
          placeholder="Search username"
          autoComplete="off"
        />
        {followUsername ? (
          <p className="text-sm text-cyan-100">Selected @{followUsername}</p>
        ) : null}
        {usersQuery.data && usersQuery.data.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {usersQuery.data.map((user: FarcasterUserOption) => (
              <li key={user.username}>
                <button
                  type="button"
                  onClick={() => {
                    onFollowUsername(user.username);
                    onFollowQuery(user.username);
                  }}
                  className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-sm text-white hover:border-cyan-400/30"
                >
                  <span className="font-semibold">@{user.username}</span>
                  {user.displayName ? (
                    <span className="text-white/45">{user.displayName}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : followQuery.trim().length >= 2 && !usersQuery.isFetching ? (
          <p className="text-sm text-white/50">
            No matches. You can still use @{followQuery.replace(/^@/, "")} if you
            know the account.
          </p>
        ) : null}
      </div>
    );
  }

  if (taskType === "mini_app") {
    return (
      <div className="flex flex-col gap-3">
        {!miniManual ? (
          <>
            <label className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-white/45">
              Search Mini App
            </label>
            <input
              className={inputClass}
              value={miniAppQuery}
              onChange={(event) => onMiniAppQuery(event.target.value)}
              placeholder="Mini App name"
              autoComplete="off"
            />
            {appsQuery.data && appsQuery.data.length > 0 ? (
              <ul className="flex flex-col gap-1.5">
                {appsQuery.data.map((app: MiniAppTaskTarget) => (
                  <li key={app.url}>
                    <button
                      type="button"
                      onClick={() => {
                        onMiniAppUrl(app.url);
                        onMiniAppName(app.name ?? "");
                        onMiniAppQuery(app.name ?? app.url);
                      }}
                      className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-left hover:border-cyan-400/30"
                    >
                      <p className="text-sm font-semibold text-white">
                        {app.name ?? app.url}
                      </p>
                      <p className="truncate text-[0.65rem] text-white/45">{app.url}</p>
                    </button>
                  </li>
                ))}
              </ul>
            ) : miniAppQuery.trim().length >= 2 && !appsQuery.isFetching ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-sm text-white/70">Can&apos;t find the app?</p>
                <button
                  type="button"
                  onClick={() => onMiniManual(true)}
                  className="mt-2 text-sm font-semibold text-cyan-200"
                >
                  Add URL manually
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onMiniManual(true)}
                className="text-left text-sm text-white/50"
              >
                Can&apos;t find the app? Add URL manually
              </button>
            )}
          </>
        ) : (
          <>
            <label className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-white/45">
              Mini App URL
            </label>
            <input
              className={inputClass}
              value={miniAppUrl}
              onChange={(event) => onMiniAppUrl(event.target.value)}
              placeholder="https://"
              autoComplete="off"
            />
            <input
              className={inputClass}
              value={miniAppName}
              onChange={(event) => onMiniAppName(event.target.value)}
              placeholder="App name (optional)"
              autoComplete="off"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={inspecting}
                onClick={async () => {
                  setInspecting(true);
                  setInspectMessage(null);
                  const result = await inspectMiniAppRequest(miniAppUrl);
                  setInspecting(false);
                  if (result.target) {
                    onMiniAppUrl(result.target.url);
                    if (result.target.name) {
                      onMiniAppName(result.target.name);
                    }
                    setInspectMessage(
                      "URL inspected only. Opening this Mini App has not been verified.",
                    );
                    return;
                  }
                  setInspectMessage(result.error ?? "Unable to inspect URL");
                }}
                className="inline-flex min-h-10 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-500/15 px-4 text-[0.72rem] font-semibold uppercase tracking-wide text-cyan-100 disabled:opacity-50"
              >
                {inspecting ? "Inspecting…" : "Verify App"}
              </button>
              <button
                type="button"
                onClick={() => onMiniManual(false)}
                className="text-sm text-white/50"
              >
                Back to search
              </button>
            </div>
            {inspectMessage ? (
              <p className="text-[0.7rem] text-white/55">{inspectMessage}</p>
            ) : null}
          </>
        )}
        {miniAppUrl ? (
          <p className="text-[0.7rem] text-cyan-100/80">
            {miniAppName ? `${miniAppName} — ` : ""}
            {miniAppUrl}
          </p>
        ) : null}
      </div>
    );
  }

  const parsed = castUrl.trim() ? parseFarcasterCastUrl(castUrl) : null;

  return (
    <div className="flex flex-col gap-3">
      <label className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-white/45">
        Farcaster Cast URL
      </label>
      <input
        className={inputClass}
        value={castUrl}
        onChange={(event) => onCastUrl(event.target.value)}
        placeholder="https://farcaster.xyz/username/0x…"
        autoComplete="off"
      />
      {castUrl.trim() && !parsed ? (
        <p className="text-[0.7rem] text-rose-200">
          Enter a warpcast.com or farcaster.xyz cast URL.
        </p>
      ) : null}
      {parsed ? (
        <p className="text-[0.7rem] text-emerald-100/80">
          {parsed.castHash
            ? `Cast hash ${parsed.castHash} stored for later verification.`
            : "URL valid. Cast hash will be stored if it can be read from the link."}
        </p>
      ) : null}
    </div>
  );
}
