-- Task2Earn Phase 1: off-chain Share Cast BQR ledger.
-- Service-role writes only. No on-chain transfers.

-- ---------------------------------------------------------------------------
-- Shares: store resolved FID and prevent FID farming across wallets
-- ---------------------------------------------------------------------------

alter table if exists public.t2e_shares
  add column if not exists fid bigint;

create unique index if not exists t2e_shares_task_fid_kind_uidx
  on public.t2e_shares (task_id, fid, share_kind)
  where fid is not null;

-- Existing wallet uniqueness remains:
-- constraint t2e_shares_task_wallet_kind_uidx unique (task_id, wallet_address, share_kind)

-- ---------------------------------------------------------------------------
-- Off-chain reward ledger
-- ---------------------------------------------------------------------------

create table if not exists public.t2e_reward_ledger (
  id uuid primary key default gen_random_uuid(),
  claim_id text not null,
  wallet_address text not null,
  fid bigint not null,
  reward_type text not null
    check (reward_type in ('share_cast')),
  source text not null
    check (source in ('farcaster_share')),
  reference_id uuid not null references public.t2e_tasks (id) on delete cascade,
  amount_bqr numeric not null
    check (amount_bqr > 0),
  status text not null default 'pending'
    check (status in ('pending', 'credited', 'claimed', 'void')),
  cast_hash text,
  share_id uuid references public.t2e_shares (id) on delete set null,
  created_at timestamptz not null default now(),
  credited_at timestamptz,
  claimed_at timestamptz,
  tx_hash text,
  constraint t2e_reward_ledger_claim_id_uidx unique (claim_id),
  constraint t2e_reward_ledger_type_ref_fid_uidx unique (reward_type, reference_id, fid)
);

create index if not exists t2e_reward_ledger_wallet_idx
  on public.t2e_reward_ledger (wallet_address);

create index if not exists t2e_reward_ledger_reference_idx
  on public.t2e_reward_ledger (reference_id);

create unique index if not exists t2e_reward_ledger_cast_hash_uidx
  on public.t2e_reward_ledger (cast_hash)
  where cast_hash is not null;

alter table if exists public.t2e_reward_ledger enable row level security;
