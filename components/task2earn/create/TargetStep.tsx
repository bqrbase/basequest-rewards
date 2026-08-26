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
import { useEffect, useState } from "react";

const SEARCH_DEBOUNCE_MS = 350;
const SEARCH_MIN_LENGTH = 2;

const inputClass =
  "w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white placeholder:text-white/35 outline-none focus:border-cyan-400/40";

function FarcasterAvatar({
  url,
  name,
}: {
  url: string | null;
  name: string;
}) {
  const initial = name.trim().slice(0, 1).toUpperCase() || "?";
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        width={40}
        height={40}
        className="h-10 w-10 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-sm font-semibold text-cyan-100">
      {initial}
    </span>
  );
}

function metadataString(
  metadata: Record<string, unknown> | undefined,
  key: string,
): string | null {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

type TargetStepProps = {
  taskType: TaskType;
  castUrl: string;
  onCastUrl: (value: string) => void;
  followQuery: string;
  onFollowQuery: (value: string) => void;
  followUsername: string;
  onFollowUsername: (value: string) => void;
  followFid: number | null;
  onFollowFid: (value: number | null) => void;
  followDisplayName: string | null;
  onFollowDisplayName: (value: string | null) => void;
  followPfpUrl: string | null;
  onFollowPfpUrl: (value: string | null) => void;
  miniAppQuery: string;
  onMiniAppQuery: (value: string) => void;
  miniAppUrl: string;
  onMiniAppUrl: (value: string) => void;
  miniAppName: string;
  onMiniAppName: (value: string) => void;
  miniAppIconUrl: string | null;
  onMiniAppIconUrl: (value: string | null) => void;
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
  followFid,
  onFollowFid,
  followDisplayName,
  onFollowDisplayName,
  followPfpUrl,
  onFollowPfpUrl,
  miniAppQuery,
  onMiniAppQuery,
  miniAppUrl,
  onMiniAppUrl,
  miniAppName,
  onMiniAppName,
  miniAppIconUrl,
  onMiniAppIconUrl,
  miniManual,
  onMiniManual,
}: TargetStepProps) {
  const [inspectMessage, setInspectMessage] = useState<string | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [debouncedFollowQuery, setDebouncedFollowQuery] = useState("");
  const [debouncedMiniAppQuery, setDebouncedMiniAppQuery] = useState("");

  useEffect(() => {
    const trimmed = followQuery.trim().replace(/^@/, "");
    if (followFid !== null) {
      setDebouncedFollowQuery("");
      return;
    }
    const handle = window.setTimeout(() => {
      setDebouncedFollowQuery(trimmed);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [followFid, followQuery]);

  const followSearchReady =
    taskType === "follow" &&
    followFid === null &&
    debouncedFollowQuery.length >= SEARCH_MIN_LENGTH;

  const usersQuery = useQuery({
    queryKey: ["t2e-user-search", debouncedFollowQuery],
    queryFn: () => searchFarcasterUsersRequest(debouncedFollowQuery),
    enabled: followSearchReady,
    staleTime: 30_000,
    retry: 1,
  });

  useEffect(() => {
    const trimmed = miniAppQuery.trim();
    if (miniManual || miniAppUrl) {
      setDebouncedMiniAppQuery("");
      return;
    }
    const handle = window.setTimeout(() => {
      setDebouncedMiniAppQuery(trimmed);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [miniAppQuery, miniAppUrl, miniManual]);

  const miniAppSearchReady =
    taskType === "mini_app" &&
    !miniManual &&
    !miniAppUrl &&
    debouncedMiniAppQuery.length >= SEARCH_MIN_LENGTH;

  const appsQuery = useQuery({
    queryKey: ["t2e-miniapp-search", debouncedMiniAppQuery],
    queryFn: () => searchMiniAppsRequest(debouncedMiniAppQuery),
    enabled: miniAppSearchReady,
    staleTime: 30_000,
    retry: 1,
  });

  if (taskType === "follow") {
    const typedQuery = followQuery.trim().replace(/^@/, "");
    const waitingForDebounce =
      followFid === null &&
      typedQuery.length >= SEARCH_MIN_LENGTH &&
      typedQuery !== debouncedFollowQuery;
    const searching = waitingForDebounce || usersQuery.isFetching;
    const users = usersQuery.data ?? [];
    const showDropdown = followFid === null && typedQuery.length >= SEARCH_MIN_LENGTH;

    function selectUser(user: FarcasterUserOption) {
      onFollowFid(user.fid);
      onFollowUsername(user.username);
      onFollowDisplayName(user.displayName);
      onFollowPfpUrl(user.pfpUrl);
      onFollowQuery(user.username);
    }

    function clearSelection() {
      onFollowFid(null);
      onFollowUsername("");
      onFollowDisplayName(null);
      onFollowPfpUrl(null);
    }

    return (
      <div className="flex flex-col gap-3 overflow-visible">
        <label className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-white/45">
          Farcaster account to follow
        </label>
        {followFid !== null && followUsername ? (
          <div className="flex items-center gap-3 rounded-xl border border-cyan-400/30 bg-white/[0.06] px-3 py-2.5">
            <FarcasterAvatar
              url={followPfpUrl}
              name={followDisplayName || followUsername}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">
                {followDisplayName || `@${followUsername}`}
              </p>
              <p className="truncate text-[0.7rem] text-white/55">
                @{followUsername} · FID {followFid}
              </p>
            </div>
            <button
              type="button"
              onClick={clearSelection}
              className="shrink-0 rounded-full px-3 py-2 text-[0.7rem] font-semibold uppercase tracking-wide text-cyan-100"
            >
              Change
            </button>
          </div>
        ) : (
          <div className="relative z-20 overflow-visible">
            <input
              className={inputClass}
              value={followQuery}
              onChange={(event) => {
                if (followFid !== null) {
                  clearSelection();
                }
                onFollowQuery(event.target.value);
              }}
              placeholder="Search username or display name"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              inputMode="search"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={showDropdown}
              aria-controls="farcaster-user-results"
            />
            {showDropdown ? (
              <div
                id="farcaster-user-results"
                role="listbox"
                className="mt-1 max-h-64 overflow-y-auto overscroll-contain rounded-xl border border-white/10 bg-[#0c1224] shadow-[0_12px_32px_rgba(0,0,0,0.45)] [-webkit-overflow-scrolling:touch]"
              >
                {searching ? (
                  <p className="px-3 py-3 text-sm text-white/60">Searching…</p>
                ) : usersQuery.isError ? (
                  <p className="px-3 py-3 text-sm text-rose-200">
                    {usersQuery.error instanceof Error
                      ? usersQuery.error.message
                      : "Unable to search Farcaster users. Try again."}
                  </p>
                ) : users.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-white/60">
                    No users found
                  </p>
                ) : (
                  <ul className="flex flex-col py-1">
                    {users.map((user) => (
                      <li key={user.fid} role="option">
                        <button
                          type="button"
                          onClick={() => selectUser(user)}
                          className="flex min-h-12 w-full items-center gap-3 px-3 py-3 text-left text-white [touch-action:manipulation] hover:bg-white/[0.06] active:bg-white/[0.1]"
                        >
                          <FarcasterAvatar
                            url={user.pfpUrl}
                            name={user.displayName || user.username}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">
                              {user.displayName || `@${user.username}`}
                            </span>
                            <span className="mt-0.5 block truncate text-[0.7rem] text-white/55">
                              @{user.username} · FID {user.fid}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>
    );
  }

  if (taskType === "mini_app") {
    const typedQuery = miniAppQuery.trim();
    const selected = Boolean(miniAppUrl) && !miniManual;
    const waitingForDebounce =
      !selected &&
      typedQuery.length >= SEARCH_MIN_LENGTH &&
      typedQuery !== debouncedMiniAppQuery;
    const searching = waitingForDebounce || appsQuery.isFetching;
    const apps = appsQuery.data ?? [];
    const showDropdown =
      !selected && !miniManual && typedQuery.length >= SEARCH_MIN_LENGTH;

    function selectApp(app: MiniAppTaskTarget) {
      onMiniAppUrl(app.url);
      onMiniAppName(app.name ?? "");
      onMiniAppQuery(app.name ?? app.url);
      onMiniAppIconUrl(metadataString(app.metadata, "iconUrl"));
    }

    function clearAppSelection() {
      onMiniAppUrl("");
      onMiniAppName("");
      onMiniAppQuery("");
      onMiniAppIconUrl(null);
    }

    return (
      <div className="flex flex-col gap-3 overflow-visible">
        {!miniManual ? (
          <>
            <label className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-white/45">
              Search Mini App
            </label>
            {selected ? (
              <div className="flex items-center gap-3 rounded-xl border border-cyan-400/30 bg-white/[0.06] px-3 py-2.5">
                <FarcasterAvatar
                  url={miniAppIconUrl}
                  name={miniAppName || miniAppUrl}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">
                    {miniAppName || miniAppUrl}
                  </p>
                  <p className="truncate text-[0.7rem] text-white/55">
                    {miniAppUrl}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearAppSelection}
                  className="shrink-0 rounded-full px-3 py-2 text-[0.7rem] font-semibold uppercase tracking-wide text-cyan-100"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="relative z-20 overflow-visible">
                <input
                  className={inputClass}
                  value={miniAppQuery}
                  onChange={(event) => {
                    if (miniAppUrl) {
                      clearAppSelection();
                    }
                    onMiniAppQuery(event.target.value);
                  }}
                  placeholder="Mini App name"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  inputMode="search"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={showDropdown}
                  aria-controls="farcaster-miniapp-results"
                />
                {showDropdown ? (
                  <div
                    id="farcaster-miniapp-results"
                    role="listbox"
                    className="mt-1 max-h-64 overflow-y-auto overscroll-contain rounded-xl border border-white/10 bg-[#0c1224] shadow-[0_12px_32px_rgba(0,0,0,0.45)] [-webkit-overflow-scrolling:touch]"
                  >
                    {searching ? (
                      <p className="px-3 py-3 text-sm text-white/60">Searching…</p>
                    ) : appsQuery.isError ? (
                      <p className="px-3 py-3 text-sm text-rose-200">
                        {appsQuery.error instanceof Error
                          ? appsQuery.error.message
                          : "Unable to search Farcaster Mini Apps. Try again."}
                      </p>
                    ) : apps.length === 0 ? (
                      <p className="px-3 py-3 text-sm text-white/60">
                        No apps found
                      </p>
                    ) : (
                      <ul className="flex flex-col py-1">
                        {apps.map((app: MiniAppTaskTarget) => {
                          const iconUrl = metadataString(app.metadata, "iconUrl");
                          const authorUsername = metadataString(
                            app.metadata,
                            "authorUsername",
                          );
                          const authorDisplayName = metadataString(
                            app.metadata,
                            "authorDisplayName",
                          );
                          const secondary = authorUsername
                            ? `@${authorUsername} · ${app.url}`
                            : authorDisplayName
                              ? `${authorDisplayName} · ${app.url}`
                              : app.url;
                          return (
                            <li key={app.url} role="option">
                              <button
                                type="button"
                                onClick={() => selectApp(app)}
                                className="flex min-h-12 w-full items-center gap-3 px-3 py-3 text-left text-white [touch-action:manipulation] hover:bg-white/[0.06] active:bg-white/[0.1]"
                              >
                                <FarcasterAvatar
                                  url={iconUrl}
                                  name={app.name || app.url}
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-semibold">
                                    {app.name || app.url}
                                  </span>
                                  <span className="mt-0.5 block truncate text-[0.7rem] text-white/55">
                                    {secondary}
                                  </span>
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                ) : null}
              </div>
            )}
            <button
              type="button"
              onClick={() => onMiniManual(true)}
              className="text-left text-sm text-white/50"
            >
              Can&apos;t find the app? Add URL manually
            </button>
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
                    onMiniAppIconUrl(
                      metadataString(result.target.metadata, "iconUrl"),
                    );
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
