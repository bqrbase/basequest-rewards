-- OPTIONAL manual seed. Not a migration. Never applied automatically.
-- Off-chain Task2Earn verification test: one unfunded OPEN Follow task.
--
-- Before running:
--   1. Replace YOUR_FARCASTER_USERNAME with a real account you can follow/unfollow.
--   2. Do not run this in production unless you intend to.
--   3. This does not create deposits, payouts, claims, or escrow rows.
--
-- The task is identifiable by title "TEST — Task2Earn Verification"
-- and is hidden from GET /api/tasks unless T2E_SHOW_TEST_TASKS=true.

insert into public.t2e_tasks (
  id,
  creator_wallet,
  title,
  description,
  task_type,
  reward_token,
  pool_amount,
  pool_usd_value,
  campaign_fee_usd,
  campaign_fee_token_amount,
  duration_days,
  split_mode,
  starts_at,
  ends_at,
  status,
  max_participants,
  target_audience,
  task_target,
  share_cast_enabled,
  share_snap_enabled,
  share_cast_reward_bqr,
  share_snap_reward_bqr
)
values (
  'c0ffee00-4e21-4000-8000-00000000e401',
  '0x0000000000000000000000000000000000000001',
  'TEST — Task2Earn Verification',
  'Off-chain Farcaster Follow verification test. Unfunded display-only pool. No escrow, claims, payouts, or token transfers.',
  'follow',
  'BQR',
  0,
  0,
  0,
  0,
  7,
  'equal',
  now(),
  now() + interval '7 days',
  'open',
  50,
  '{}'::jsonb,
  jsonb_build_object(
    'kind', 'follow',
    'username', 'YOUR_FARCASTER_USERNAME',
    'fid', null,
    'displayName', null
  ),
  false,
  false,
  0,
  0
)
on conflict (id) do update
set
  status = excluded.status,
  pool_amount = 0,
  pool_usd_value = 0,
  campaign_fee_usd = 0,
  campaign_fee_token_amount = 0,
  share_cast_enabled = false,
  share_snap_enabled = false,
  share_cast_reward_bqr = 0,
  share_snap_reward_bqr = 0,
  task_target = excluded.task_target,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  updated_at = now();
