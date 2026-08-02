"use client";

import {
  buildQuestDefinitionsFromCatalog,
  getDefaultProgress,
  getProgressStats,
  getQuestViewModels,
  loadProgress,
  normalizeStreak,
  performQuestAction,
  QUEST_DEFINITIONS,
  saveProgress,
  type QuestDefinition,
  type QuestId,
  type QuestProgress,
} from "@/lib/quest-engine";
import { getLevel } from "@/lib/levels";
import { completeReferralClient } from "@/lib/referrals/client";
import { REFERRAL_ONBOARDING_QUEST_ID } from "@/lib/referrals/constants";
import { fetchQuests } from "@/lib/supabase/quests";
import { fetchUser, userRowToProgress } from "@/lib/supabase/users";
import { useWalletAuth } from "@/hooks/useWalletAuth";
import { calculateGenesisXP } from "@/lib/genesis/xp";
import { useGenesisAccess } from "@/hooks/useGenesisAccess";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";

function maybeCompleteReferral(
  walletAddress: string | undefined,
  progress: QuestProgress,
) {
  if (!walletAddress) {
    return;
  }
  if (!progress.completedQuestIds.includes(REFERRAL_ONBOARDING_QUEST_ID)) {
    return;
  }
  void completeReferralClient(walletAddress);
}

function getStorageWalletAddress(address?: string | null) {
  return address?.toLowerCase() ?? null;
}

function cacheProgressLocally(
  progress: QuestProgress,
  walletAddress?: string | null,
) {
  saveProgress(normalizeStreak(progress), walletAddress);
}

const SERVER_OWNED_QUESTS = new Set<QuestId>([
  "daily-check-in",
  "view-leaderboard",
  "build-streak",
  "explore-base",
]);

async function syncProgressFromServer(wallet: string): Promise<QuestProgress | null> {
  const response = await fetch("/api/progress/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ wallet }),
  });
  const json = (await response.json()) as {
    success?: boolean;
    progress?: QuestProgress;
  };
  if (!response.ok || !json.success || !json.progress) {
    return null;
  }
  return json.progress;
}

async function completeQuestOnServer(params: {
  wallet: string;
  questId: QuestId;
}): Promise<QuestProgress | null> {
  const response = await fetch("/api/quests/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(params),
  });
  const json = (await response.json()) as {
    success?: boolean;
    progress?: QuestProgress;
  };
  if (!response.ok || !json.success || !json.progress) {
    return null;
  }
  return json.progress;
}

export function useQuestEngine() {
  const [progress, setProgress] = useState<QuestProgress>(getDefaultProgress);
  const [questDefinitions, setQuestDefinitions] =
    useState<QuestDefinition[]>(QUEST_DEFINITIONS);
  const [hydrated, setHydrated] = useState(false);
  const [progressReady, setProgressReady] = useState(false);
  const [levelUpLevel, setLevelUpLevel] = useState<number | null>(null);
  const { address, status: walletStatus } = useAccount();
  const { ensureWalletAuth, hasWalletAuthSession } = useWalletAuth();
  const { canReceiveGenesisXPBonus } = useGenesisAccess();
  const isWalletConnected = walletStatus === "connected";
  const isWalletReconnecting =
    walletStatus === "connecting" || walletStatus === "reconnecting";
  const storageWalletAddress = getStorageWalletAddress(address);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    setProgressReady(false);
  }, [storageWalletAddress, isWalletConnected]);

  useEffect(() => {
    if (!hydrated || isWalletReconnecting) {
      return;
    }

    if (isWalletConnected && storageWalletAddress) {
      return;
    }

    const next = normalizeStreak(loadProgress(storageWalletAddress));
    setProgress(next);
    setProgressReady(true);
  }, [
    hydrated,
    storageWalletAddress,
    isWalletConnected,
    isWalletReconnecting,
  ]);

  useEffect(() => {
    let cancelled = false;

    async function loadQuestDefinitions() {
      const rows = await fetchQuests();
      if (cancelled || !rows || rows.length === 0) {
        return;
      }

      const definitions = buildQuestDefinitionsFromCatalog(rows);
      if (cancelled || definitions.length === 0) {
        return;
      }

      setQuestDefinitions(definitions);
    }

    void loadQuestDefinitions();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated || !address || !isWalletConnected) {
      return;
    }

    const walletAddress = address;
    let cancelled = false;

    /**
     * Soft hydrate on connect — never prompts for a signature.
     * Uses an existing session if present; otherwise public read / local cache.
     */
    async function hydrateProgressWithoutAuth() {
      try {
        const hasSession = await hasWalletAuthSession();
        if (cancelled) {
          return;
        }

        if (hasSession) {
          const serverProgress = await syncProgressFromServer(walletAddress);
          if (cancelled) {
            return;
          }
          if (serverProgress) {
            const next = normalizeStreak(serverProgress);
            setProgress(next);
            setProgressReady(true);
            cacheProgressLocally(next, storageWalletAddress);
            maybeCompleteReferral(walletAddress, next);
            return;
          }
        }

        const user = await fetchUser(walletAddress);
        if (cancelled) {
          return;
        }

        if (user) {
          const next = normalizeStreak(userRowToProgress(user));
          setProgress(next);
          setProgressReady(true);
          cacheProgressLocally(next, storageWalletAddress);
          return;
        }

        const fallback = normalizeStreak(loadProgress(storageWalletAddress));
        setProgress(fallback);
        setProgressReady(true);
        cacheProgressLocally(fallback, storageWalletAddress);
      } catch (error) {
        console.error(
          "[useQuestEngine] hydrateProgressWithoutAuth failed",
          error,
        );
        if (cancelled) {
          return;
        }

        const fallback = normalizeStreak(loadProgress(storageWalletAddress));
        setProgress(fallback);
        setProgressReady(true);
        cacheProgressLocally(fallback, storageWalletAddress);
      }
    }

    void hydrateProgressWithoutAuth();

    return () => {
      cancelled = true;
    };
  }, [
    hydrated,
    address,
    isWalletConnected,
    storageWalletAddress,
    hasWalletAuthSession,
  ]);

  const applyLocalProgress = useCallback(
    (nextProgress: QuestProgress) => {
      const next = normalizeStreak(nextProgress);
      setProgress(next);
      cacheProgressLocally(next, storageWalletAddress);
      maybeCompleteReferral(address, next);
    },
    [address, storageWalletAddress],
  );

  const applyServerProgress = useCallback(
    (nextProgress: QuestProgress) => {
      const previousLevel = getLevel(progress.totalXp);
      const next = normalizeStreak(nextProgress);
      const newLevel = getLevel(next.totalXp);

      if (newLevel > previousLevel) {
        setLevelUpLevel(newLevel);
      }

      applyLocalProgress(next);
    },
    [applyLocalProgress, progress.totalXp],
  );

  const handleQuestAction = useCallback(
    (questId: QuestId) => {
      const previous = progress;
      const previousLevel = getLevel(previous.totalXp);
      const definition = questDefinitions.find((item) => item.id === questId);
      const baseXP = definition?.rewardXp ?? 0;
      const { totalXP: rewardXpOverride } = calculateGenesisXP(baseXP, {
        canReceiveGenesisXPBonus,
      });

      // Optimistic local update for responsiveness; server is authoritative.
      const optimistic = performQuestAction(
        previous,
        questId,
        undefined,
        questDefinitions,
        definition ? { rewardXpOverride } : undefined,
      );
      applyLocalProgress(optimistic);

      const rollbackOptimistic = () => {
        applyLocalProgress(previous);
      };

      // Server-owned quests must match DB — never keep optimistic XP on failure.
      if (SERVER_OWNED_QUESTS.has(questId)) {
        if (!address || !isWalletConnected) {
          rollbackOptimistic();
          return;
        }

        void (async () => {
          const auth = await ensureWalletAuth();
          if (!auth.ok) {
            rollbackOptimistic();
            return;
          }

          const serverProgress = await completeQuestOnServer({
            wallet: address,
            questId,
          });

          if (!serverProgress) {
            rollbackOptimistic();
            return;
          }

          const newLevel = getLevel(serverProgress.totalXp);
          if (newLevel > previousLevel) {
            setLevelUpLevel(newLevel);
          }
          applyLocalProgress(serverProgress);
        })();
        return;
      }

      const optimisticLevel = getLevel(optimistic.totalXp);
      if (optimisticLevel > previousLevel) {
        setLevelUpLevel(optimisticLevel);
      }
    },
    [
      address,
      applyLocalProgress,
      canReceiveGenesisXPBonus,
      ensureWalletAuth,
      isWalletConnected,
      progress,
      questDefinitions,
    ],
  );

  const quests = useMemo(
    () => getQuestViewModels(progress, questDefinitions),
    [progress, questDefinitions],
  );
  const progressStats = useMemo(() => getProgressStats(progress), [progress]);

  return {
    hydrated,
    progressReady,
    progress,
    quests,
    progressStats,
    totalXp: progress.totalXp,
    levelUpLevel,
    clearLevelUpCelebration: () => setLevelUpLevel(null),
    handleQuestAction,
    applyServerProgress,
  };
}
