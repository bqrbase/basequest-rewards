/**
 * Task2Earn domain types.
 * Independent of quest IDs, XP, and RewardsDistributor Merkle claims.
 */

export type TaskType =
  | "follow"
  | "like"
  | "recast"
  | "comment"
  | "like_recast"
  | "like_recast_comment"
  | "bundle"
  | "mini_app";

export type RewardToken = "BQR" | "USDC" | "ETH";

export type TaskStatus =
  | "draft"
  | "open"
  | "active"
  | "ended"
  | "cancelled";

export type ParticipantStatus = "joined" | "verified" | "rejected";

export type VerificationType =
  | "follow"
  | "like"
  | "recast"
  | "comment"
  | "mini_app"
  | "share_cast"
  | "share_snap";

export type VerificationStatus = "pending" | "verified" | "failed";

/** Allowed campaign lengths in days. Custom hours are not supported. */
export type CampaignDuration = 1 | 2 | 3 | 7;

export type PoolSplitMode = "equal";

export type AccountingStatus = "pending" | "confirmed" | "failed";

export type ShareKind = "cast" | "snap";

export type ShareStatus = "pending" | "verified" | "failed";

export type LeaderPeriod = "all_time" | "weekly";

/**
 * Optional audience filters. Omitted / null / false means no filter.
 */
export type AudienceRules = {
  minimum_followers?: number | null;
  minimum_neynar_score?: number | null;
  minimum_account_age_days?: number | null;
  non_spam_only?: boolean;
  profile_photo_required?: boolean;
};

/**
 * Off-chain task target. FID is stored only when the server resolved it.
 * Client-supplied FID is never treated as proof.
 */
export type CastTaskTarget = {
  kind: "cast";
  url: string;
  castHash: string | null;
  channelId: string | null;
};

export type FollowTaskTarget = {
  kind: "follow";
  username: string;
  fid: number | null;
  displayName: string | null;
};

export type MiniAppTaskTarget = {
  kind: "mini_app";
  name: string | null;
  url: string;
  appId: string | null;
  metadata: Record<string, unknown>;
};

export type TaskTarget = CastTaskTarget | FollowTaskTarget | MiniAppTaskTarget;

/** Client create payload. Server ignores FID, hashes, fees, and USD. */
export type CreateDraftTaskRequest = {
  wallet: string;
  taskType: TaskType;
  title: string;
  description: string;
  rewardToken: RewardToken;
  poolAmount: string;
  durationDays: CampaignDuration;
  maxParticipants?: number | null;
  audience?: AudienceRules;
  target?: {
    kind?: string;
    url?: string;
    username?: string;
    /** Selection hint only. Server re-resolves via Neynar and never treats this as proof. */
    fid?: number;
    name?: string;
  };
  shareCastEnabled?: boolean;
  shareSnapEnabled?: boolean;
};

export type TokenUsdPrices = {
  BQR: number | null;
  USDC: number | null;
  ETH: number | null;
};

export type CampaignRules = {
  durationDays: CampaignDuration;
  minPoolUsd: number;
  feeUsd: number;
};

export type Task2EarnTask = {
  id: string;
  creatorWallet: string;
  title: string;
  description: string;
  taskType: TaskType;
  rewardToken: RewardToken;
  poolAmount: string;
  poolUsdValue: string;
  campaignFeeUsd: string;
  campaignFeeTokenAmount: string;
  durationDays: CampaignDuration;
  splitMode: PoolSplitMode;
  startsAt: string;
  endsAt: string;
  status: TaskStatus;
  maxParticipants: number | null;
  targetAudience: AudienceRules;
  taskTarget: TaskTarget | null;
  shareCastEnabled: boolean;
  shareSnapEnabled: boolean;
  shareCastRewardBqr: string;
  shareSnapRewardBqr: string;
  createdAt: string;
  updatedAt: string;
};

export type Task2EarnParticipant = {
  id: string;
  taskId: string;
  walletAddress: string;
  fid: number | null;
  status: ParticipantStatus;
  joinedAt: string;
  verifiedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
};

export type Task2EarnVerification = {
  id: string;
  participantId: string;
  verificationType: VerificationType;
  provider: string;
  status: VerificationStatus;
  castHash: string | null;
  evidence: Record<string, unknown>;
  metadata: Record<string, unknown>;
  verifiedAt: string | null;
  createdAt: string;
};

export type TaskMarketplaceItem = Task2EarnTask & {
  participantCount: number;
  verifiedCount: number;
  estimatedRewardPerUser: string | null;
};

export type TaskDetailPayload = TaskMarketplaceItem & {
  joinable: boolean;
  viewerParticipant: Task2EarnParticipant | null;
};
