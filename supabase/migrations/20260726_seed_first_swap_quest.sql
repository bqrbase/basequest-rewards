-- Seed the first-swap quest into public.quests.
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
    'first-swap',
    'Complete your first swap',
    'Swap tokens on Base Mainnet with Quick Swap. Completes only after a confirmed on-chain transaction.',
    25,
    'active',
    10,
    true
  )
on conflict (id) do nothing;
