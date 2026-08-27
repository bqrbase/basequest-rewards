-- Standalone BQR Share Rewards: off-chain daily credits without a Task2Earn task.
-- Additive only. Does not drop tables, delete rows, or alter escrow/payout/share tables.
--
-- Pool cap 10000 MUST stay in sync with BQR_SHARE_REWARDS_POOL_BQR in
-- lib/task2earn/constants.ts (re-exported from share-rewards-display.ts).
-- Cooldown 24 hours MUST stay in sync with SHARE_CAST_MAX_AGE_MS.
--
-- btree_gist is NOT created here (not declared in prior migrations).
-- If the host already has btree_gist, an optional GiST exclusion is added.
-- 24h races are always enforced by a BEFORE INSERT trigger using
-- built-in pg_advisory_xact_lock (no extra extension).

-- ---------------------------------------------------------------------------
-- 1. Nullable reference_id (FK to t2e_tasks kept for non-null values)
-- ---------------------------------------------------------------------------

alter table if exists public.t2e_reward_ledger
  alter column reference_id drop not null;

-- ---------------------------------------------------------------------------
-- 2. Allow reward_type = bqr_share_daily
-- ---------------------------------------------------------------------------

do $$
declare
  constraint_name text;
begin
  select c.conname
    into constraint_name
  from pg_constraint c
  join pg_class t on c.conrelid = t.oid
  join pg_namespace n on t.relnamespace = n.oid
  where n.nspname = 'public'
    and t.relname = 't2e_reward_ledger'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) ilike '%reward_type%'
  limit 1;

  if constraint_name is not null then
    execute format(
      'alter table public.t2e_reward_ledger drop constraint %I',
      constraint_name
    );
  end if;
end $$;

alter table if exists public.t2e_reward_ledger
  add constraint t2e_reward_ledger_reward_type_check
  check (reward_type in ('share_cast', 'bqr_share_daily'));

-- ---------------------------------------------------------------------------
-- 3. Task uniqueness: one share_cast (or other typed) credit per fid per task
--    Only when reference_id is present. Standalone rows use reference_id NULL.
-- ---------------------------------------------------------------------------

alter table if exists public.t2e_reward_ledger
  drop constraint if exists t2e_reward_ledger_type_ref_fid_uidx;

drop index if exists public.t2e_reward_ledger_type_ref_fid_uidx;

create unique index if not exists t2e_reward_ledger_task_type_ref_fid_uidx
  on public.t2e_reward_ledger (reward_type, reference_id, fid)
  where reference_id is not null;

-- UNIQUE (claim_id) and unique (cast_hash) where not null are unchanged.

-- ---------------------------------------------------------------------------
-- 4. Optional GiST 24h exclusion if btree_gist is already installed
-- ---------------------------------------------------------------------------

do $gist$
begin
  if exists (select 1 from pg_extension where extname = 'btree_gist')
    and not exists (
      select 1
      from pg_constraint
      where conname = 't2e_reward_ledger_standalone_fid_24h_excl'
    )
  then
    alter table public.t2e_reward_ledger
      add constraint t2e_reward_ledger_standalone_fid_24h_excl
      exclude using gist (
        fid with =,
        tstzrange(credited_at, credited_at + interval '24 hours', '[)') with &&
      )
      where (
        reward_type = 'bqr_share_daily'
        and status = 'credited'
        and credited_at is not null
      );
  end if;
end
$gist$;

-- ---------------------------------------------------------------------------
-- 5. Guard: pool cap 10000 + rolling 24h per FID (advisory lock, no new extension)
-- ---------------------------------------------------------------------------

create or replace function public.t2e_standalone_share_credit_guard()
returns trigger
language plpgsql
as $$
declare
  credited_total numeric;
  fid_key integer;
begin
  if new.reward_type is distinct from 'bqr_share_daily'
    or new.status is distinct from 'credited'
  then
    return new;
  end if;

  -- Lock order: pool then FID, to avoid deadlocks.
  perform pg_advisory_xact_lock(872651002);
  fid_key := (abs(new.fid) % 2147483647)::integer;
  perform pg_advisory_xact_lock(872651001, fid_key);

  select coalesce(sum(amount_bqr), 0)
    into credited_total
  from public.t2e_reward_ledger
  where reward_type = 'bqr_share_daily'
    and status = 'credited';

  -- Keep in sync with BQR_SHARE_REWARDS_POOL_BQR = 10000
  if credited_total + new.amount_bqr > 10000 then
    raise exception 'standalone_pool_depleted'
      using errcode = '23514';
  end if;

  -- Keep in sync with SHARE_CAST_MAX_AGE_MS = 24 hours
  if new.fid is not null
    and new.credited_at is not null
    and exists (
      select 1
      from public.t2e_reward_ledger as existing
      where existing.reward_type = 'bqr_share_daily'
        and existing.status = 'credited'
        and existing.fid = new.fid
        and existing.credited_at is not null
        and tstzrange(
          existing.credited_at,
          existing.credited_at + interval '24 hours',
          '[)'
        ) && tstzrange(
          new.credited_at,
          new.credited_at + interval '24 hours',
          '[)'
        )
    )
  then
    raise exception 'standalone_share_cooldown'
      using errcode = '23P01';
  end if;

  return new;
end;
$$;

drop trigger if exists t2e_standalone_share_credit_guard_trg
  on public.t2e_reward_ledger;

create trigger t2e_standalone_share_credit_guard_trg
before insert on public.t2e_reward_ledger
for each row
execute function public.t2e_standalone_share_credit_guard();
