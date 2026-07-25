-- Seed missing rows into public.quests from the app quest catalog.
-- Does not update existing rows (ON CONFLICT DO NOTHING).
--
-- App catalog source: lib/quest-engine.ts → QUEST_DEFINITIONS
-- Table shape: lib/supabase/quests.ts / README.md
--
-- Likely already present (README seed):
--   daily-check-in, view-leaderboard, build-streak, explore-base
-- Likely missing:
--   follow-x, follow-farcaster, deploy-contract, claim-nft, x402-payment

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
    'daily-check-in',
    'Daily Check-in',
    'Check in once per day to earn rewards and keep your streak alive.',
    10,
    'active',
    1,
    true
  ),
  (
    'view-leaderboard',
    'View Leaderboard',
    'Open the leaderboard for the first time.',
    25,
    'active',
    2,
    true
  ),
  (
    'build-streak',
    'Build Your Streak',
    'Return daily to grow your streak and unlock bonus engagement rewards.',
    5,
    'active',
    3,
    true
  ),
  (
    'explore-base',
    'Explore Base Apps',
    'Discover popular apps in the Base ecosystem and earn bonus XP.',
    15,
    'active',
    4,
    true
  ),
  (
    'follow-x',
    'Follow us on X',
    'Follow @bqrbase on X to stay updated with BaseQuest Rewards.',
    25,
    'active',
    5,
    true
  ),
  (
    'follow-farcaster',
    'Follow us on Farcaster',
    'Follow @hqc on Farcaster and join the BaseQuest community.',
    25,
    'active',
    6,
    true
  ),
  (
    'deploy-contract',
    'Deploy Contract',
    'Choose a contract template and deploy your first contract on Base.',
    50,
    'active',
    7,
    true
  ),
  (
    'claim-nft',
    'Claim NFT',
    'Mint your BaseQuest Builder Badge NFT after deploying your first contract.',
    50,
    'active',
    8,
    true
  ),
  (
    'x402-payment',
    'Make an x402 Payment',
    'Call the premium x402 endpoint and complete one successful payment on Base Mainnet.',
    100,
    'active',
    9,
    true
  )
on conflict (id) do nothing;
