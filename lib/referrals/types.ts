export type ReferralStatus = "pending" | "completed";

export type ReferralCodeRow = {
  id: string;
  wallet_address: string;
  code: string;
  created_at: string;
};

export type ReferralRow = {
  id: string;
  referrer_wallet: string;
  referee_wallet: string;
  referral_code: string;
  status: ReferralStatus;
  reward_xp: number;
  created_at: string;
  completed_at: string | null;
  rewarded_at: string | null;
};

export type ReferralStats = {
  totalReferrals: number;
  successfulReferrals: number;
  pendingReferrals: number;
  totalReferralXp: number;
};

export type ReferralDashboard = {
  code: string;
  link: string;
  stats: ReferralStats;
};

export type ReferralLeaderboardEntry = {
  wallet_address: string;
  successful_referrals: number;
  total_referral_xp: number;
};
