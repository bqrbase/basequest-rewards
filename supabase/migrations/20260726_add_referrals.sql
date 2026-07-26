-- Referral codes (one unique code per wallet) and referral relationships.
-- Rewards are applied via the service-role admin client after onboarding completes.

create table if not exists referral_codes (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null unique,
  code text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists referral_codes_code_idx
  on referral_codes (code);

create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_wallet text not null,
  referee_wallet text not null unique,
  referral_code text not null,
  status text not null default 'pending'
    check (status in ('pending', 'completed')),
  reward_xp integer not null default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  rewarded_at timestamptz,
  constraint referrals_no_self_referral
    check (referrer_wallet <> referee_wallet)
);

create index if not exists referrals_referrer_wallet_idx
  on referrals (referrer_wallet);

create index if not exists referrals_status_idx
  on referrals (status);

create index if not exists referrals_referrer_completed_idx
  on referrals (referrer_wallet, status);

alter table if exists referral_codes enable row level security;
alter table if exists referrals enable row level security;
