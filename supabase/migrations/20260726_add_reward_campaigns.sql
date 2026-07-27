-- Merkle rewards campaigns + allocations for RewardsDistributor.
-- Privileged on-chain createCampaign/fund stay external; this stores metadata + proofs only.

create table if not exists reward_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  -- draft | snapshotted | ready | published | closed
  status text not null default 'draft'
    check (status in ('draft', 'snapshotted', 'ready', 'published', 'closed')),
  campaign_type smallint not null default 0,
  -- Planned / linked on-chain campaign id (RewardsDistributor.campaignCount assignment).
  on_chain_campaign_id bigint,
  merkle_root text,
  start_time bigint not null default 0,
  end_time bigint not null default 0,
  leaf_count integer not null default 0,
  total_amount_wei numeric not null default 0,
  bqr_decimals smallint not null default 18,
  build_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  built_at timestamptz,
  published_at timestamptz
);

create index if not exists reward_campaigns_status_idx
  on reward_campaigns (status);

create unique index if not exists reward_campaigns_on_chain_id_uidx
  on reward_campaigns (on_chain_campaign_id)
  where on_chain_campaign_id is not null;

create table if not exists reward_allocations (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references reward_campaigns (id) on delete cascade,
  wallet_address text not null,
  -- Stable off-chain key, e.g. "daily-check-in" or "referral:3"
  action_key text not null,
  reward_id text not null,
  amount_bqr numeric not null,
  amount_wei numeric not null,
  leaf_hash text,
  leaf_index integer,
  merkle_proof jsonb not null default '[]'::jsonb,
  claimed_on_chain boolean not null default false,
  claimed_synced_at timestamptz,
  claim_tx_hash text,
  created_at timestamptz not null default now(),
  unique (campaign_id, wallet_address, reward_id),
  unique (campaign_id, leaf_index)
);

create index if not exists reward_allocations_wallet_idx
  on reward_allocations (wallet_address);

create index if not exists reward_allocations_campaign_wallet_idx
  on reward_allocations (campaign_id, wallet_address);

create index if not exists reward_allocations_action_key_idx
  on reward_allocations (action_key);

-- Optional audit of successful claim txs (client or sync may write).
create table if not exists reward_claim_receipts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references reward_campaigns (id) on delete cascade,
  allocation_id uuid references reward_allocations (id) on delete set null,
  wallet_address text not null,
  on_chain_campaign_id bigint not null,
  reward_id text not null,
  claim_id text not null,
  amount_wei numeric not null,
  tx_hash text not null unique,
  chain_id integer not null default 8453,
  created_at timestamptz not null default now()
);

create index if not exists reward_claim_receipts_wallet_idx
  on reward_claim_receipts (wallet_address);

alter table if exists reward_campaigns enable row level security;
alter table if exists reward_allocations enable row level security;
alter table if exists reward_claim_receipts enable row level security;
