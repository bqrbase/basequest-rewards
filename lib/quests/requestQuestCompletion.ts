import type { QuestProgress } from "@/lib/quest-engine";

export type QuestCompletionClientResult = {
  success: boolean;
  alreadyCompleted: boolean;
  progress: QuestProgress | null;
  error?: string;
};

/**
 * Shared client helper for POST quest complete API endpoints.
 */
export async function requestQuestCompletion(params: {
  endpoint: string;
  body: Record<string, unknown>;
}): Promise<QuestCompletionClientResult> {
  try {
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
