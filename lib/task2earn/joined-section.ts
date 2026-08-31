import type { ParticipantStatus, TaskStatus } from "./types";

export type JoinedTaskSection = "ongoing" | "completed" | "ended";

function campaignStillActive(status: TaskStatus, endsAtIso: string): boolean {
  if (status !== "open" && status !== "active") {
    return false;
  }
  return Date.parse(endsAtIso) > Date.now();
}

/**
 * Mutually exclusive My Tasks tab.
 * Completed = this wallet verified. Ongoing = campaign still active.
 * Ended = campaign over (or cancelled) without verification.
 */
export function joinedTaskSection(task: {
  status: TaskStatus;
  endsAt: string;
  viewerParticipantStatus?: ParticipantStatus | null;
}): JoinedTaskSection {
  if (task.viewerParticipantStatus === "verified") {
    return "completed";
  }
  if (campaignStillActive(task.status, task.endsAt)) {
    return "ongoing";
  }
  return "ended";
}
