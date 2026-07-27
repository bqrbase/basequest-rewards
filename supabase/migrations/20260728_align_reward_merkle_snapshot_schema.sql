-- Align rewards schema with the current Merkle publish flow:
--   draft → snapshotted (eligibility rows, leaf materialization optional)
--        → ready (root + proofs) → published → closed
--
-- Live DB still rejected status "snapshotted" and required NOT NULL
-- leaf_hash / leaf_index, which breaks snapshot-before-build.
-- This migration is idempotent and preserves existing rows.

-- 1) Allow snapshotted campaign status (and keep existing values valid).
alter table public.reward_campaigns
  drop constraint if exists reward_campaigns_status_check;

alter table public.reward_campaigns
  add constraint reward_campaigns_status_check
  check (
    status in ('draft', 'snapshotted', 'ready', 'published', 'closed')
  );

-- 2) Snapshot may insert allocations before Merkle proofs are built.
--    Leaf = keccak256(account, rewardId, amount); hash/index/proof filled at build.
alter table public.reward_allocations
  alter column leaf_hash drop not null;

alter table public.reward_allocations
  alter column leaf_index drop not null;

-- 3) Unique (campaign_id, leaf_index) must allow multiple NULL indexes
--    during snapshotted state. Replace any non-partial unique constraint
--    with a partial unique index on non-null leaf_index only.
do $$
declare
  con_name text;
begin
  select c.conname into con_name
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'reward_allocations'
    and c.contype = 'u'
    and pg_get_constraintdef(c.oid) ilike '%leaf_index%';

  if con_name is not null then
    execute format(
      'alter table public.reward_allocations drop constraint %I',
      con_name
    );
  end if;
end $$;

drop index if exists public.reward_allocations_campaign_id_leaf_index_key;
drop index if exists public.reward_allocations_campaign_leaf_index_uidx;

create unique index if not exists reward_allocations_campaign_leaf_index_uidx
  on public.reward_allocations (campaign_id, leaf_index)
  where leaf_index is not null;
