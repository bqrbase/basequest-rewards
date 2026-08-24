import {
  doesFidFollowTarget,
  fetchCastByHashOrUrl,
  fetchUserRepliesPage,
  fetchUsersByFids,
  lookupFarcasterUserByUsername,
  lookupFidByWalletAddress,
} from "@/lib/farcaster/neynar";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSupabaseError } from "@/lib/supabase/errors";
import { T2E_TABLES } from "@/lib/task2earn/db";
import { getTaskRequirements } from "@/lib/task2earn/display";
import { getMarketplaceTask } from "@/lib/task2earn/server";
import type {
  Task2EarnParticipant,
  TaskTarget,
  VerificationStatus,
  VerificationType,
} from "@/lib/task2earn/types";
import {
  allChecksPassed,
  checkComment,
  checkFollow,
  checkLike,
  checkRecast,
  evaluateAudience,
  findMatchingReply,
  MAX_REPLY_PAGES,
  missingFidCheck,
  parseCastLookup,
  parseNeynarUserProfile,
  parseReplyFeed,
  summarizeFailure,
  unsupportedMiniAppCheck,
  unsupportedShareSnapCheck,
  type ParsedCastLookup,
  type ParsedReply,
  type ParsedUserProfile,
  type VerificationCheck,
} from "@/lib/task2earn/verification-logic";

export type VerifyTaskResult = {
  eligible: boolean;
  participantStatus: "joined" | "verified" | "rejected";
  checks: VerificationCheck[];
  error?: string;
  status?: number;
};

function requireAdmin() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    throw new Error("task2earn_unavailable");
  }
  return supabase;
}

async function loadCast(
  target: Extract<TaskTarget, { kind: "cast" }>,
  viewerFid: number,
): Promise<ParsedCastLookup | null> {
  const payload = await fetchCastByHashOrUrl({
    url: target.url,
    hash: target.castHash,
    viewerFid,
  });
  return parseCastLookup(payload);
}

async function loadProfile(fid: number): Promise<ParsedUserProfile | null> {
  const payload = await fetchUsersByFids([fid]);
  return parseNeynarUserProfile(payload, fid);
}

async function findReplyEvidence(params: {
  participantFid: number;
  targetHash: string | null;
  targetUrl: string | null;
}): Promise<ParsedReply | null> {
  let cursor: string | null = null;
  for (let page = 0; page < MAX_REPLY_PAGES; page += 1) {
    const payload = await fetchUserRepliesPage({
      fid: params.participantFid,
      cursor,
    });
    const parsed = parseReplyFeed(payload);
    const match = findMatchingReply(parsed.replies, params.participantFid, {
      hash: params.targetHash,
      url: params.targetUrl,
    });
    if (match) {
      return match;
    }
    if (!parsed.cursor) {
      break;
    }
    cursor = parsed.cursor;
  }
  return null;
}

async function writeVerification(params: {
  participantId: string;
  type: VerificationType;
  status: VerificationStatus;
  castHash?: string | null;
  evidence: Record<string, unknown>;
}) {
  const supabase = requireAdmin();
  const verifiedAt = params.status === "verified" ? new Date().toISOString() : null;
  const { error } = await supabase.from(T2E_TABLES.verifications).insert({
    participant_id: params.participantId,
    verification_type: params.type,
    provider: "neynar",
    status: params.status,
    cast_hash: params.castHash ?? null,
    evidence: params.evidence,
    metadata: {},
    verified_at: verifiedAt,
  });
  if (error) {
    logSupabaseError("verifyTaskParticipant", "insert verification", error, {
      type: params.type,
    });
    throw error;
  }
}

async function persistParticipant(params: {
  participantId: string;
  fid: number;
  eligible: boolean;
  reason: string;
}) {
  const supabase = requireAdmin();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from(T2E_TABLES.participants)
    .update(
      params.eligible
        ? {
            fid: params.fid,
            status: "verified",
            verified_at: now,
            rejected_at: null,
            rejection_reason: null,
          }
        : {
            fid: params.fid,
            status: "rejected",
            verified_at: null,
            rejected_at: now,
            rejection_reason: params.reason.slice(0, 500),
          },
    )
    .eq("id", params.participantId);
  if (error) {
    logSupabaseError("verifyTaskParticipant", "update participant", error);
    throw error;
  }
}

async function verifyFollow(params: {
  participantFid: number;
  username?: string;
  targetFid?: number | null;
}): Promise<{ check: VerificationCheck; evidence: Record<string, unknown> }> {
  let targetFid = params.targetFid ?? null;
  if (!targetFid && params.username) {
    const user = await lookupFarcasterUserByUsername(params.username);
    targetFid = user?.fid ?? null;
  }
  if (!targetFid && !params.username) {
    return {
      check: {
        type: "follow",
        status: "failed",
        message: "Follow target is not configured",
      },
      evidence: { error: "missing_follow_target" },
    };
  }

  const following = await doesFidFollowTarget({
    viewerFid: params.participantFid,
    ...(targetFid ? { targetFid } : {}),
    ...(params.username ? { targetUsername: params.username } : {}),
  });

  return {
    check: checkFollow(following),
    evidence: {
      viewerFid: params.participantFid,
      targetFid,
      username: params.username ?? null,
      following,
      verifiedAt: new Date().toISOString(),
    },
  };
}

async function persistMissingFid(participantId: string, reason: string) {
  const supabase = requireAdmin();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from(T2E_TABLES.participants)
    .update({
      status: "rejected",
      verified_at: null,
      rejected_at: now,
      rejection_reason: reason.slice(0, 500),
    })
    .eq("id", participantId);
  if (error) {
    logSupabaseError("verifyTaskParticipant", "update missing FID participant", error);
    throw error;
  }
}

/**
 * Off-chain Task2Earn verification. Never trusts client FID or client evidence.
 * Does not transfer tokens, create claims, or write payouts.
 */
export async function verifyTaskParticipant(params: {
  taskId: string;
  walletAddress: string;
}): Promise<VerifyTaskResult> {
  const task = await getMarketplaceTask(params.taskId, params.walletAddress);
  if (!task) {
    return {
      eligible: false,
      participantStatus: "joined",
      checks: [],
      error: "task_not_found",
      status: 404,
    };
  }

  if (task.status === "draft" || task.status === "cancelled") {
    return {
      eligible: false,
      participantStatus: task.viewerParticipant?.status ?? "joined",
      checks: [],
      error: "task_not_verifiable",
      status: 409,
    };
  }

  const participant = task.viewerParticipant;
  if (!participant) {
    return {
      eligible: false,
      participantStatus: "joined",
      checks: [],
      error: "participant_not_found",
      status: 404,
    };
  }

  let participantFid: number | null = null;
  try {
    participantFid = await lookupFidByWalletAddress(params.walletAddress);
  } catch (error) {
    console.error("[task2earn] FID lookup failed during verify", error);
  }

  if (!participantFid) {
    const identity = missingFidCheck();
    await persistMissingFid(participant.id, identity.message);
    return {
      eligible: false,
      participantStatus: "rejected",
      checks: [identity],
    };
  }

  const requirements = getTaskRequirements(task.taskType);
  const checks: VerificationCheck[] = [];
  const writes: Array<{
    type: VerificationType;
    status: VerificationStatus;
    castHash?: string | null;
    evidence: Record<string, unknown>;
  }> = [];

  const audience = evaluateAudience(
    await loadProfile(participantFid),
    task.targetAudience,
  );
  checks.push(...audience.checks);

  if (task.taskType === "mini_app") {
    const check = unsupportedMiniAppCheck();
    checks.push(check);
    writes.push({
      type: "mini_app",
      status: "failed",
      evidence: { unsupported: true, reason: check.message },
    });
    return finish({
      participant,
      participantFid,
      checks,
      writes,
    });
  }

  const target = task.taskTarget;

  try {
    if (requirements.includes("follow") && task.taskType === "follow") {
      if (!target || target.kind !== "follow") {
        return configError(participant, "Follow target is missing or invalid");
      }
      const result = await verifyFollow({
        participantFid,
        username: target.username,
        targetFid: target.fid,
      });
      checks.push(result.check);
      writes.push({
        type: "follow",
        status: result.check.status === "passed" ? "verified" : "failed",
        evidence: result.evidence,
      });
    }

    const needsCast =
      requirements.includes("like") ||
      requirements.includes("recast") ||
      requirements.includes("comment") ||
      (requirements.includes("follow") && task.taskType === "bundle");

    let cast: ParsedCastLookup | null = null;
    if (needsCast) {
      if (!target || target.kind !== "cast") {
        return configError(
          participant,
          "Cast target is missing or invalid; cannot verify this task",
        );
      }
      cast = await loadCast(target, participantFid);
      if (!cast) {
        checks.push({
          type: "cast",
          status: "failed",
          message: "Could not resolve the target cast",
        });
        return finish({ participant, participantFid, checks, writes });
      }
    }

    if (task.taskType === "bundle") {
      if (!cast) {
        return configError(participant, "Bundle tasks require a resolvable cast");
      }
      const follow = await verifyFollow({
        participantFid,
        targetFid: cast.authorFid,
      });
      checks.push(follow.check);
      writes.push({
        type: "follow",
        status: follow.check.status === "passed" ? "verified" : "failed",
        evidence: {
          ...follow.evidence,
          followTarget: "cast_author",
        },
      });
    }

    if (cast && (requirements.includes("like") || requirements.includes("recast"))) {
      const evidence = {
        canonicalCastHash: cast.hash,
        authorFid: cast.authorFid,
        liked: cast.liked,
        recasted: cast.recasted,
        participantFid,
        verifiedAt: new Date().toISOString(),
      };
      if (requirements.includes("like")) {
        const like = checkLike(cast.liked);
        checks.push(like);
        writes.push({
          type: "like",
          status: like.status === "passed" ? "verified" : "failed",
          castHash: cast.hash,
          evidence,
        });
      }
      if (requirements.includes("recast")) {
        const recast = checkRecast(cast.recasted);
        checks.push(recast);
        writes.push({
          type: "recast",
          status: recast.status === "passed" ? "verified" : "failed",
          castHash: cast.hash,
          evidence,
        });
      }
    }

    if (requirements.includes("comment")) {
      if (!cast && target?.kind !== "cast") {
        return configError(participant, "Comment verification requires a cast target");
      }
      const reply = await findReplyEvidence({
        participantFid,
        targetHash: cast?.hash ?? (target?.kind === "cast" ? target.castHash : null),
        targetUrl: target?.kind === "cast" ? target.url : null,
      });
      const comment = checkComment(Boolean(reply));
      checks.push(comment);
      if (reply) {
        writes.push({
          type: "comment",
          status: "verified",
          castHash: reply.hash,
          evidence: {
            replyCastHash: reply.hash,
            replyAuthorFid: reply.authorFid,
            parentHashes: reply.parentHashes,
            participantFid,
            verifiedAt: new Date().toISOString(),
          },
        });
      } else {
        writes.push({
          type: "comment",
          status: "failed",
          evidence: {
            participantFid,
            targetHash: cast?.hash ?? null,
            found: false,
          },
        });
      }
    }
  } catch (error) {
    console.error("[task2earn] verification action failed", error);
    checks.push({
      type: "provider",
      status: "failed",
      message: "Farcaster verification provider is temporarily unavailable",
    });
  }

  if (task.shareSnapEnabled) {
    const snap = unsupportedShareSnapCheck();
    checks.push(snap);
    writes.push({
      type: "share_snap",
      status: "failed",
      evidence: { unsupported: true, reason: snap.message },
    });
  }

  return finish({ participant, participantFid, checks, writes });
}

function configError(
  participant: Task2EarnParticipant,
  message: string,
): VerifyTaskResult {
  return {
    eligible: false,
    participantStatus: participant.status,
    checks: [{ type: "config", status: "failed", message }],
    error: "task_misconfigured",
    status: 409,
  };
}

async function finish(params: {
  participant: Task2EarnParticipant;
  participantFid: number;
  checks: VerificationCheck[];
  writes: Array<{
    type: VerificationType;
    status: VerificationStatus;
    castHash?: string | null;
    evidence: Record<string, unknown>;
  }>;
}): Promise<VerifyTaskResult> {
  const eligible = allChecksPassed(params.checks);
  for (const row of params.writes) {
    await writeVerification({
      participantId: params.participant.id,
      type: row.type,
      status: row.status,
      castHash: row.castHash,
      evidence: row.evidence,
    });
  }
  await persistParticipant({
    participantId: params.participant.id,
    fid: params.participantFid,
    eligible,
    reason: summarizeFailure(params.checks) || "Verification did not pass",
  });

  return {
    eligible,
    participantStatus: eligible ? "verified" : "rejected",
    checks: params.checks,
  };
}
