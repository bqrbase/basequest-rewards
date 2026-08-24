-- Task2Earn Phase 1: isolated marketplace schema.
--
-- Uses public.t2e_* tables (not a dedicated Postgres schema).
-- Existing Supabase/PostgREST clients only expose `public`, and the app
-- admin client has no custom-schema option. A `task2earn` schema would
-- require dashboard API schema exposure and would not work with the
-- current RLS/client setup.
--
-- Independent of quests / users.total_xp / users.completed_quests /
-- reward_* Merkle tables. Writes are service-role only (RLS on, no
-- anon INSERT/UPDATE/DELETE policies). Accounting tables are
-- foundations only — no escrow or on-chain payment logic.

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------

create table if not exists public.t2e_tasks (
  id uuid primary key default gen_random_uuid(),
  creator_wallet text not null,
  title text not null,
  description text not null default '',
  task_type text not null
    check (task_type in (
      'follow',
      'like',
      'recast',
      'comment',
      'like_recast',
      'like_recast_comment',
      'bundle',
      'mini_app'
    )),
  reward_token text not null
    check (reward_token in ('BQR', 'USDC', 'ETH')),
  -- Token units as decimal (not assumed 18-decimal wei). No transfer here.
  pool_amount numeric not null default 0
    check (pool_amount >= 0),
  pool_usd_value numeric not null default 0
    check (pool_usd_value >= 0),
  campaign_fee_usd numeric not null
    check (campaign_fee_usd >= 0),
  campaign_fee_token_amount numeric not null default 0
    check (campaign_fee_token_amount >= 0),
  duration_days smallint not null
    check (duration_days in (1, 2, 3, 7)),
  split_mode text not null default 'equal'
    check (split_mode in ('equal')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'draft'
    check (status in ('draft', 'open', 'active', 'ended', 'cancelled')),
  max_participants integer
    check (max_participants is null or max_participants > 0),
  -- Optional audience filters (all keys optional):
  -- minimum_followers, minimum_neynar_score, minimum_account_age_days,
  -- non_spam_only, profile_photo_required
  target_audience jsonb not null default '{}'::jsonb,
  share_cast_enabled boolean not null default false,
  share_snap_enabled boolean not null default false,
  share_cast_reward_bqr numeric not null default 0
    check (share_cast_reward_bqr >= 0),
  share_snap_reward_bqr numeric not null default 0
    check (share_snap_reward_bqr >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint t2e_tasks_ends_after_starts
    check (ends_at > starts_at)
);

create index if not exists t2e_tasks_status_ends_idx
  on public.t2e_tasks (status, ends_at);

create index if not exists t2e_tasks_creator_wallet_idx
  on public.t2e_tasks (creator_wallet);

create index if not exists t2e_tasks_task_type_idx
  on public.t2e_tasks (task_type);

-- ---------------------------------------------------------------------------
-- Participants
-- ---------------------------------------------------------------------------

create table if not exists public.t2e_participants (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.t2e_tasks (id) on delete cascade,
  wallet_address text not null,
  fid bigint,
  status text not null default 'joined'
    check (status in ('joined', 'verified', 'rejected')),
  joined_at timestamptz not null default now(),
  verified_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text,
  constraint t2e_participants_task_wallet_uidx
    unique (task_id, wallet_address)
);

create index if not exists t2e_participants_wallet_idx
  on public.t2e_participants (wallet_address);

create index if not exists t2e_participants_task_status_idx
  on public.t2e_participants (task_id, status);

create index if not exists t2e_participants_fid_idx
  on public.t2e_participants (fid)
  where fid is not null;

-- ---------------------------------------------------------------------------
-- Verifications (social / mini-app evidence; no payments)
-- ---------------------------------------------------------------------------

create table if not exists public.t2e_verifications (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.t2e_participants (id) on delete cascade,
  verification_type text not null
    check (verification_type in (
      'follow',
      'like',
      'recast',
      'comment',
      'mini_app',
      'share_cast',
      'share_snap'
    )),
  provider text not null default 'neynar',
  status text not null default 'pending'
    check (status in ('pending', 'verified', 'failed')),
  cast_hash text,
  evidence jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists t2e_verifications_participant_idx
  on public.t2e_verifications (participant_id);

create index if not exists t2e_verifications_type_status_idx
  on public.t2e_verifications (verification_type, status);

create index if not exists t2e_verifications_cast_hash_idx
  on public.t2e_verifications (cast_hash)
  where cast_hash is not null;

-- ---------------------------------------------------------------------------
-- Sharing (Cast / Snap) — reward_bqr is intent only, no transfer
-- ---------------------------------------------------------------------------

create table if not exists public.t2e_shares (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.t2e_tasks (id) on delete cascade,
  wallet_address text not null,
  share_kind text not null
    check (share_kind in ('cast', 'snap')),
  status text not null default 'pending'
    check (status in ('pending', 'verified', 'failed')),
  cast_hash text,
  snap_image_url text,
  reward_bqr numeric not null default 0
    check (reward_bqr >= 0),
  verified_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint t2e_shares_task_wallet_kind_uidx
    unique (task_id, wallet_address, share_kind)
);

create index if not exists t2e_shares_wallet_idx
  on public.t2e_shares (wallet_address);

create index if not exists t2e_shares_task_status_idx
  on public.t2e_shares (task_id, status);

-- ---------------------------------------------------------------------------
-- Accounting foundations (no escrow / no chain writes)
-- ---------------------------------------------------------------------------

create table if not exists public.t2e_pool_deposits (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.t2e_tasks (id) on delete cascade,
  depositor_wallet text not null,
  token text not null
    check (token in ('BQR', 'USDC', 'ETH')),
  amount numeric not null default 0
    check (amount >= 0),
  usd_value numeric not null default 0
    check (usd_value >= 0),
  tx_hash text,
  chain_id integer not null default 8453,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'failed')),
  created_at timestamptz not null default now()
);

create index if not exists t2e_pool_deposits_task_idx
  on public.t2e_pool_deposits (task_id);

create table if not exists public.t2e_payouts (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.t2e_tasks (id) on delete cascade,
  participant_id uuid references public.t2e_participants (id) on delete set null,
  wallet_address text not null,
  token text not null
    check (token in ('BQR', 'USDC', 'ETH')),
  amount numeric not null default 0
    check (amount >= 0),
  usd_value numeric not null default 0
    check (usd_value >= 0),
  tx_hash text,
  chain_id integer not null default 8453,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'failed')),
  created_at timestamptz not null default now()
);

create index if not exists t2e_payouts_task_idx
  on public.t2e_payouts (task_id);

create index if not exists t2e_payouts_wallet_idx
  on public.t2e_payouts (wallet_address);

create table if not exists public.t2e_claims (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.t2e_tasks (id) on delete cascade,
  participant_id uuid references public.t2e_participants (id) on delete set null,
  wallet_address text not null,
  token text not null
    check (token in ('BQR', 'USDC', 'ETH')),
  amount numeric not null default 0
    check (amount >= 0),
  tx_hash text,
  chain_id integer not null default 8453,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'failed')),
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint t2e_claims_task_wallet_uidx
    unique (task_id, wallet_address)
);

create index if not exists t2e_claims_wallet_idx
  on public.t2e_claims (wallet_address);

-- ---------------------------------------------------------------------------
-- Stats / leaders — separate from users.total_xp and completed_quests
-- ---------------------------------------------------------------------------

create table if not exists public.t2e_stats (
  wallet_address text primary key,
  fid bigint,
  tasks_created integer not null default 0,
  tasks_joined integer not null default 0,
  tasks_verified integer not null default 0,
  shares_cast integer not null default 0,
  shares_snap integer not null default 0,
  total_earned_usd numeric not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.t2e_leader_scores (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null,
  period text not null default 'all_time'
    check (period in ('all_time', 'weekly')),
  score numeric not null default 0,
  rank integer,
  updated_at timestamptz not null default now(),
  constraint t2e_leader_scores_wallet_period_uidx
    unique (wallet_address, period)
);

create index if not exists t2e_leader_scores_period_score_idx
  on public.t2e_leader_scores (period, score desc);

-- ---------------------------------------------------------------------------
-- RLS: anon/authenticated cannot write. Service role bypasses RLS.
-- Public SELECT on tasks only (marketplace listing).
-- ---------------------------------------------------------------------------

alter table if exists public.t2e_tasks enable row level security;
alter table if exists public.t2e_participants enable row level security;
alter table if exists public.t2e_verifications enable row level security;
alter table if exists public.t2e_shares enable row level security;
alter table if exists public.t2e_pool_deposits enable row level security;
alter table if exists public.t2e_payouts enable row level security;
alter table if exists public.t2e_claims enable row level security;
alter table if exists public.t2e_stats enable row level security;
alter table if exists public.t2e_leader_scores enable row level security;

drop policy if exists "Allow anon select t2e_tasks" on public.t2e_tasks;
create policy "Allow anon select t2e_tasks"
  on public.t2e_tasks
  for select
  to anon
  using (true);

drop policy if exists "Allow authenticated select t2e_tasks" on public.t2e_tasks;
create policy "Allow authenticated select t2e_tasks"
  on public.t2e_tasks
  for select
  to authenticated
  using (true);

drop policy if exists "Allow anon select t2e_leader_scores" on public.t2e_leader_scores;
create policy "Allow anon select t2e_leader_scores"
  on public.t2e_leader_scores
  for select
  to anon
  using (true);

drop policy if exists "Allow authenticated select t2e_leader_scores" on public.t2e_leader_scores;
create policy "Allow authenticated select t2e_leader_scores"
  on public.t2e_leader_scores
  for select
  to authenticated
  using (true);
