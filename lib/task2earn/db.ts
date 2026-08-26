/**
 * Task2Earn table names and row shapes.
 * Type-safe stubs only — no payment, escrow, or quest/XP writes.
 *
 * Tables: public.t2e_* (see supabase/migrations/20260824_task2earn.sql)
 */

import type {
  AccountingStatus,
  AudienceRules,
  CampaignDuration,
  TaskTarget,
  LeaderPeriod,
  ParticipantStatus,
  PoolSplitMode,
  RewardToken,
  ShareKind,
  ShareStatus,
  TaskStatus,
  TaskType,
  VerificationStatus,
  VerificationType,
} from "@/lib/task2earn/types";

export const T2E_TABLES = {
  tasks: "t2e_tasks",
  participants: "t2e_participants",
  verifications: "t2e_verifications",
  shares: "t2e_shares",
  poolDeposits: "t2e_pool_deposits",
  payouts: "t2e_payouts",
  claims: "t2e_claims",
  stats: "t2e_stats",
  leaderScores: "t2e_leader_scores",
  rewardLedger: "t2e_reward_ledger",
} as const;

export type T2eTableName = (typeof T2E_TABLES)[keyof typeof T2E_TABLES];

export type T2eTaskRow = {
  id: string;
  creator_wallet: string;
  title: string;
  description: string;
  task_type: TaskType;
  reward_token: RewardToken;
  pool_amount: string | number;
  pool_usd_value: string | number;
  campaign_fee_usd: string | number;
  campaign_fee_token_amount: string | number;
  duration_days: CampaignDuration;
  split_mode: PoolSplitMode;
  starts_at: string;
  ends_at: string;
  status: TaskStatus;
  max_participants: number | null;
  target_audience: AudienceRules;
  task_target?: TaskTarget | Record<string, never> | null;
  share_cast_enabled: boolean;
  share_snap_enabled: boolean;
  share_cast_reward_bqr: string | number;
  share_snap_reward_bqr: string | number;
  created_at: string;
  updated_at: string;
};

export type T2eParticipantRow = {
  id: string;
  task_id: string;
  wallet_address: string;
  fid: number | null;
  status: ParticipantStatus;
  joined_at: string;
  verified_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
};

export type T2eVerificationRow = {
  id: string;
  participant_id: string;
  verification_type: VerificationType;
  provider: string;
  status: VerificationStatus;
  cast_hash: string | null;
  evidence: Record<string, unknown>;
  metadata: Record<string, unknown>;
  verified_at: string | null;
  created_at: string;
};

export type T2eShareRow = {
  id: string;
  task_id: string;
  wallet_address: string;
  fid: number | null;
  share_kind: ShareKind;
  status: ShareStatus;
  cast_hash: string | null;
  snap_image_url: string | null;
  reward_bqr: string | number;
  verified_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type T2eRewardLedgerStatus = "pending" | "credited" | "claimed" | "void";

export type T2eRewardType = "share_cast";

export type T2eRewardSource = "farcaster_share";

export type T2eRewardLedgerRow = {
  id: string;
  claim_id: string;
  wallet_address: string;
  fid: number;
  reward_type: T2eRewardType;
  source: T2eRewardSource;
  reference_id: string;
  amount_bqr: string | number;
  status: T2eRewardLedgerStatus;
  cast_hash: string | null;
  share_id: string | null;
  created_at: string;
  credited_at: string | null;
  claimed_at: string | null;
  tx_hash: string | null;
};

export type T2ePoolDepositRow = {
  id: string;
  task_id: string;
  depositor_wallet: string;
  token: RewardToken;
  amount: string | number;
  usd_value: string | number;
  tx_hash: string | null;
  chain_id: number;
  status: AccountingStatus;
  created_at: string;
};

export type T2ePayoutRow = {
  id: string;
  task_id: string;
  participant_id: string | null;
  wallet_address: string;
  token: RewardToken;
  amount: string | number;
  usd_value: string | number;
  tx_hash: string | null;
  chain_id: number;
  status: AccountingStatus;
  created_at: string;
};

export type T2eClaimRow = {
  id: string;
  task_id: string;
  participant_id: string | null;
  wallet_address: string;
  token: RewardToken;
  amount: string | number;
  tx_hash: string | null;
  chain_id: number;
  status: AccountingStatus;
  claimed_at: string | null;
  created_at: string;
};

export type T2eStatsRow = {
  wallet_address: string;
  fid: number | null;
  tasks_created: number;
  tasks_joined: number;
  tasks_verified: number;
  shares_cast: number;
  shares_snap: number;
  total_earned_usd: string | number;
  updated_at: string;
};

export type T2eLeaderScoreRow = {
  id: string;
  wallet_address: string;
  period: LeaderPeriod;
  score: string | number;
  rank: number | null;
  updated_at: string;
};
