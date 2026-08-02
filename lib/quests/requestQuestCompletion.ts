import type { QuestProgress } from "@/lib/quest-engine";

export type QuestCompletionClientResult = {
  success: boolean;
  alreadyCompleted: boolean;
  progress: QuestProgress | null;
  error?: string;
};

type EnsureAuthFn = () => Promise<{ ok: true } | { ok: false; error: string }>;

/**
 * Shared client helper for POST quest complete API endpoints.
 * Lazily authenticates when `ensureAuth` is provided (preferred).
 */
export async function requestQuestCompletion(params: {
  endpoint: string;
  body: Record<string, unknown>;
  /** Call before the protected request — prompts to sign only if needed. */
  ensureAuth?: EnsureAuthFn;
}): Promise<QuestCompletionClientResult> {
  try {
    if (params.ensureAuth) {
      const auth = await params.ensureAuth();
      if (!auth.ok) {
        return {
          success: false,
          alreadyCompleted: false,
          progress: null,
          error: auth.error || "wallet_auth_required",
        };
      }
    }

    const response = await fetch(params.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(params.body),
    });

    const json = (await response.json()) as {
      success?: boolean;
      alreadyCompleted?: boolean;
      progress?: QuestProgress;
      message?: string;
      error?: string;
    };

    if (!response.ok || !json.success || !json.progress) {
      return {
        success: false,
        alreadyCompleted: Boolean(json.alreadyCompleted),
        progress: null,
        error: json.message || json.error || "quest_completion_failed",
      };
    }

    return {
      success: true,
      alreadyCompleted: Boolean(json.alreadyCompleted),
      progress: json.progress,
    };
  } catch (error) {
    return {
      success: false,
      alreadyCompleted: false,
      progress: null,
      error: error instanceof Error ? error.message : "quest_completion_failed",
    };
  }
}
