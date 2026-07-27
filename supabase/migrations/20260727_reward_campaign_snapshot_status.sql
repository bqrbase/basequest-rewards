-- Race-safe publish: snapshot eligibility before on-chain id is known;
-- Merkle leaves are built only after bind to an existing on-chain campaignId.

alter table reward_campaigns
  drop constraint if exists reward_campaigns_status_check;

alter table reward_campaigns
  add constraint reward_campaigns_status_check
  check (status in ('draft', 'snapshotted', 'ready', 'published', 'closed'));

-- Snapshot rows may exist before leaf/proof materialization.
alter table reward_allocations
  alter column leaf_hash drop not null;

alter table reward_allocations
  alter column leaf_index drop not null;
