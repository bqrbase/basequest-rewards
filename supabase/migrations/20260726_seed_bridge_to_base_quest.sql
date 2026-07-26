-- Seed the bridge-to-base quest into public.quests.
-- Does not update existing rows (ON CONFLICT DO NOTHING).

insert into public.quests (
  id,
  title,
  description,
  reward_xp,
  status,
  display_order,
  enabled
)
values
  (
    'bridge-to-base',
    'Bridge assets to Base',
    'Bridge assets to Base Mainnet. Completes only after destination settlement on Base (bridgeStatus completed).',
    30,
    'active',
    11,
    true
  )
on conflict (id) do nothing;
